import cors from '@fastify/cors'
import Fastify, { type FastifyServerOptions } from 'fastify'
import { z } from 'zod'
import { type BridgeConfig, VERSION } from './config'
import {
  askHermes,
  checkHermes,
  HermesTimeoutError,
  type SessionStore,
} from './hermes-client'
import { SttTimeoutError, transcribeAudio } from './stt-client'

/** buildServer の依存。`fetchImpl` を差し替えると Hermes をモックできる。 */
export interface BuildServerDeps {
  config: BridgeConfig
  fetchImpl?: typeof fetch
  logger?: FastifyServerOptions['logger']
}

const AskSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  mode: z.enum(['short', 'normal']).default('short'),
})

/** 認証不要なパス（/health のみ）。OPTIONS は別途メソッドで除外する。 */
const PUBLIC_PATHS = new Set(['/health'])

/**
 * Bridge Server の Fastify インスタンスを組み立てる（listen はしない）。
 * テストは inject で叩けるよう、listen と分離している。
 */
export function buildServer(deps: BuildServerDeps) {
  const { config } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const sessions: SessionStore = new Map()
  const app = Fastify({ logger: deps.logger ?? true })

  // CORS: OPTIONS preflight と GET/POST に Access-Control-* を付与する。
  // preflight は @fastify/cors が onRequest で 204 応答して短絡するため、
  // 後段の認証 preHandler には到達しない。
  // origin は config.corsAllowedOrigins（既定 true=全反映）。実 WebView の Origin を
  // 採取後（Task 1.5）に CORS_ALLOWED_ORIGINS で allowlist 化して締める（仕様書 §15.1）。
  app.register(cors, {
    origin: config.corsAllowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // 音声 WAV を raw Buffer として受ける（`parseAs: 'buffer'` を明示しないと既定で
  // 文字列化され WAV が壊れる。仕様書 §4.2）。bodyLimit 超過は Fastify が 413 を返す。
  app.addContentTypeParser(
    'audio/wav',
    { parseAs: 'buffer', bodyLimit: config.transcribeMaxBytes },
    (_req, body, done) => done(null, body),
  )

  // WebView の実 Origin を採取する（仕様書のリスク3: iOS WKWebView が null を送る等の切り分け用）。
  app.addHook('onRequest', async (req) => {
    req.log.info(
      { origin: req.headers.origin ?? null, method: req.method, url: req.url },
      'incoming request (origin capture)',
    )
  })

  // Bearer 認証。OPTIONS（preflight）と /health は除外し、CORS preflight を壊さない
  // （仕様書のリスク1: preHandler が OPTIONS を 401 で弾くバグの回避）。
  app.addHook('preHandler', async (req, reply) => {
    if (req.method === 'OPTIONS') return
    const path = req.url.split('?')[0] ?? req.url
    if (PUBLIC_PATHS.has(path)) return
    if (extractBearerToken(req.headers.authorization) !== config.bridgeToken) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' })
    }
  })

  app.get('/health', async () => {
    const hermes = await checkHermes({ config, fetchImpl })
    return { ok: true, version: VERSION, hermes }
  })

  app.post('/v1/ask', async (req, reply) => {
    const parsed = AskSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        error: 'invalid_request',
        detail: parsed.error.issues,
      })
    }
    const { sessionId, text, mode } = parsed.data
    try {
      const result = await askHermes(
        { config, sessions, fetchImpl },
        sessionId,
        text,
        mode,
      )
      return reply.send(result)
    } catch (err) {
      if (err instanceof HermesTimeoutError) {
        return reply.code(504).send({ ok: false, error: 'hermes_timeout' })
      }
      return reply.code(502).send({
        ok: false,
        error: 'hermes_unreachable',
        detail: errorMessage(err),
      })
    }
  })

  // 音声 WAV を受け取り STT サイドカーへ転送して文字起こしを返す（仕様書 §4.2）。
  // size 上限超過は parser の bodyLimit が 413、サイドカー不達は 502、timeout は 504。
  app.post('/v1/transcribe', async (req, reply) => {
    const body = req.body
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return reply
        .code(400)
        .send({ ok: false, error: 'invalid_request', detail: 'empty audio' })
    }
    try {
      const result = await transcribeAudio({ config, fetchImpl }, body)
      return reply.send(result)
    } catch (err) {
      if (err instanceof SttTimeoutError) {
        return reply.code(504).send({ ok: false, error: 'stt_timeout' })
      }
      return reply.code(502).send({
        ok: false,
        error: 'stt_unreachable',
        detail: errorMessage(err),
      })
    }
  })

  return app
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Authorization ヘッダから Bearer トークンを取り出す。
 * スキームは大小無視（RFC 7235）、前後・スキーム後の余分な空白を許容する。
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(\S.*)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}
