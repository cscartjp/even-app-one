import cors from '@fastify/cors'
import Fastify, { type FastifyServerOptions } from 'fastify'
import { z } from 'zod'
import { synthesizeWav } from './aivis-client'
import { parseRange } from './audio-range'
import { type AudioStore, createAudioStore } from './audio-store'
import { type BridgeConfig, VERSION } from './config'
import {
  type AskResult,
  askHermes,
  checkHermes,
  HermesTimeoutError,
  type SessionStore,
} from './hermes-client'
import { checkStt, SttTimeoutError, transcribeAudio } from './stt-client'
import { createLimiter, shortenForSpeech } from './tts'

/** buildServer の依存。`fetchImpl` を差し替えると Hermes/Aivis をモックできる。 */
export interface BuildServerDeps {
  config: BridgeConfig
  fetchImpl?: typeof fetch
  logger?: FastifyServerOptions['logger']
  /** WAV キャッシュ（省略時は config から生成）。テストで seed する用途で注入可能。 */
  audioStore?: AudioStore
}

const AskSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  mode: z.enum(['short', 'normal']).default('short'),
  // 音声回答（Phase 8）。既定 false。OFF のとき TTS は一切走らず回答は現行と等価。
  tts: z.boolean().default(false),
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
  const audioStore =
    deps.audioStore ??
    createAudioStore({
      ttlSeconds: config.audioTtlSeconds,
      maxEntries: config.audioMaxEntries,
      maxBytes: config.audioMaxBytes,
    })
  // Aivis /synthesis の同時実行を絞る（重いため）。buildServer 内で 1 本共有する。
  const ttsLimiter = createLimiter(config.ttsMaxConcurrency)
  // 既定 logger は req.url の `/audio/<id>` を先頭6文字に切り詰める serializer を入れる
  // （Fastify 組み込みの request ログに capability id 全体を残さないため・spec「id ログ非露出」）。
  const app = Fastify({
    logger: deps.logger ?? {
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: redactAudioId(req.url),
            host: req.headers?.host,
            remoteAddress: req.ip,
          }
        },
      },
    },
  })

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
  // url は `/audio/<id>` の id を切り詰めてログに残さない（spec「id ログ非露出」）。
  app.addHook('onRequest', async (req) => {
    req.log.info(
      {
        origin: req.headers.origin ?? null,
        method: req.method,
        url: redactAudioId(req.url),
      },
      'incoming request (origin capture)',
    )
  })

  // Bearer 認証。OPTIONS（preflight）と /health は除外し、CORS preflight を壊さない
  // （仕様書のリスク1: preHandler が OPTIONS を 401 で弾くバグの回避）。
  // `/audio/<id>` は capability URL（256bit random id）として Bearer をスキップする。
  // `new Audio()` は Authorization を付けられないため。完全一致 set では動的 id が 401 になるので
  // **prefix 判定**で除外する（voice-answer spec の必須要件・Codex P2）。
  app.addHook('preHandler', async (req, reply) => {
    if (req.method === 'OPTIONS') return
    const path = req.url.split('?')[0] ?? req.url
    if (PUBLIC_PATHS.has(path) || path.startsWith('/audio/')) return
    if (extractBearerToken(req.headers.authorization) !== config.bridgeToken) {
      return reply.code(401).send({ ok: false, error: 'unauthorized' })
    }
  })

  app.get('/health', async () => {
    // hermes と stt の到達性は独立。直列だと遅延が加算されるため並行で確認する。
    const [hermes, stt] = await Promise.all([
      checkHermes({ config, fetchImpl }),
      checkStt({ config, fetchImpl }),
    ])
    return { ok: true, version: VERSION, hermes, stt }
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
    const { sessionId, text, mode, tts } = parsed.data
    let result: AskResult
    try {
      result = await askHermes(
        { config, sessions, fetchImpl },
        sessionId,
        text,
        mode,
      )
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

    // OFF（既定）はここで返す。新フィールドを足さず現行とバイト等価（audioUrl:null）。
    if (!tts) return reply.send(result)

    // ON: 表示用 text を短縮した speechText を Aivis で合成し、相対 audioUrl を付ける。
    // 合成失敗/timeout は audioUrl:null に降格し、テキスト回答は必ず 200 で返す（graceful）。
    const speechText = shortenForSpeech(result.text, config.ttsMaxChars)
    try {
      const wav = await ttsLimiter.run(() =>
        synthesizeWav({ config, fetchImpl }, speechText),
      )
      const id = audioStore.put(wav)
      if (!id) {
        // 総 byte 上限超過で保持できなかった → audioUrl:null に降格（404 を返さない）。
        req.log.warn(
          { bytes: wav.byteLength },
          'tts wav exceeds cache cap; degrading to audioUrl:null',
        )
        return reply.send({ ...result, speechText, audioUrl: null })
      }
      req.log.info(
        { id: `${id.slice(0, 6)}…`, bytes: wav.byteLength },
        'tts synthesized',
      )
      return reply.send({ ...result, speechText, audioUrl: `/audio/${id}` })
    } catch (err) {
      // id は未発行なので露出しない。テキスト回答は維持し audioUrl だけ落とす。
      req.log.warn(
        { err: errorMessage(err) },
        'tts synthesis failed; degrading to audioUrl:null',
      )
      return reply.send({ ...result, speechText, audioUrl: null })
    }
  })

  // 音声 WAV を受け取り STT サイドカーへ転送して文字起こしを返す（仕様書 §4.2）。
  // size 上限超過は parser の bodyLimit が 413、サイドカー不達は 502、timeout は 504。
  app.post('/v1/transcribe', async (req, reply) => {
    // Content-Type を明示検証する（仕様書 §4.2）。audio/wav 以外（既定 parser が効く
    // application/json 等）が body 欠落の 400 に化けるのを防ぎ、415 で明確に弾く。
    const mediaType = (req.headers['content-type'] ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase()
    if (mediaType !== 'audio/wav') {
      return reply.code(415).send({
        ok: false,
        error: 'unsupported_media_type',
        detail: 'Content-Type must be audio/wav',
      })
    }
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

  // 生成 WAV の capability 配信。Bearer はスキップ（256bit id で成立・上の preHandler 参照）。
  // GET/HEAD のみ・Range 対応（206/416）・no-store。未知/期限切れは 404。
  app.route({
    method: ['GET', 'HEAD'],
    url: '/audio/:id',
    handler: async (req, reply) => {
      const { id } = req.params as { id: string }
      const entry = audioStore.get(id)
      if (!entry) {
        return reply.code(404).send({ ok: false, error: 'not_found' })
      }
      const total = entry.bytes
      reply.header('Content-Type', 'audio/wav')
      reply.header('Cache-Control', 'no-store, private')
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Disposition', 'inline')

      const range = parseRange(req.headers.range, total)
      if (range.type === 'unsatisfiable') {
        reply.header('Content-Range', `bytes */${total}`)
        return reply.code(416).send()
      }
      if (req.method === 'HEAD') {
        // HEAD はメタデータのみ（本文なし）。全体長を返す。
        reply.header('Content-Length', String(total))
        return reply.code(200).send()
      }
      if (range.type === 'range') {
        const chunk = entry.buf.subarray(range.start, range.end + 1)
        reply.header(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${total}`,
        )
        reply.header('Content-Length', String(chunk.byteLength))
        return reply.code(206).send(chunk)
      }
      reply.header('Content-Length', String(total))
      return reply.code(200).send(entry.buf)
    },
  })

  // /audio/:id は GET/HEAD 以外を 405 にする（Fastify 既定の 404 ではなく明示）。
  app.route({
    method: ['POST', 'PUT', 'DELETE', 'PATCH'],
    url: '/audio/:id',
    handler: async (_req, reply) =>
      reply
        .code(405)
        .header('Allow', 'GET, HEAD')
        .send({ ok: false, error: 'method_not_allowed' }),
  })

  return app
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * `/audio/<id>` の id をログ用に先頭6文字へ切り詰める（capability id をログに残さない）。
 * 他パスはそのまま返す。クエリ文字列は保持する。
 */
function redactAudioId(url: string): string {
  return url.replace(/^(\/audio\/)([^/?]{1,6})[^/?]*/, '$1$2…')
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
