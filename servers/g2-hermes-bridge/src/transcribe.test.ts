import { describe, expect, test } from 'bun:test'
import { loadConfig } from './config'
import { buildServer } from './server'

const TOKEN = 'test-token'

/** STT サイドカーをモックした Bridge を組み立てる。env で上限/タイムアウトを上書き可能。 */
function makeApp(fetchImpl?: typeof fetch, env: NodeJS.ProcessEnv = {}) {
  const config = loadConfig({
    BRIDGE_TOKEN: TOKEN,
    HERMES_BASE_URL: 'http://hermes.test/v1',
    HERMES_API_KEY: 'k',
    STT_BASE_URL: 'http://stt.test',
    STT_TIMEOUT_MS: '50',
    ...env,
  })
  return buildServer({ config, fetchImpl, logger: false })
}

/** サイドカー `{ text, ms }` 応答相当。 */
function sttResponse(text: string, ms = 120): Response {
  return new Response(JSON.stringify({ text, ms }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** 常に `{ text, ms }` を返す fetch モック。 */
function okFetch(text = 'ok'): typeof fetch {
  return (async () => sttResponse(text)) as unknown as typeof fetch
}

const WAV = Buffer.from('RIFF....WAVEfmt fake', 'utf8')

describe('POST /v1/transcribe 認証', () => {
  test('トークン無しは 401', async () => {
    const app = makeApp(okFetch())
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: { 'content-type': 'audio/wav' },
      payload: WAV,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /v1/transcribe 正常系（サイドカーはモック）', () => {
  test('正規トークンで 200・text を返す', async () => {
    const app = makeApp(okFetch('こんにちは世界'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; text: string; ms: number }
    expect(body.ok).toBe(true)
    expect(body.text).toBe('こんにちは世界')
    expect(body.ms).toBe(120)
    await app.close()
  })

  test('audio/wav は 415 にならない（content-type parser 登録済み）', async () => {
    const app = makeApp(okFetch())
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    expect(res.statusCode).not.toBe(415)
    await app.close()
  })

  test('Buffer が壊れず転送される（parseAs:buffer で文字列化されない）', async () => {
    let received: unknown
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      received = init?.body
      return sttResponse('ok')
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    // Buffer/Uint8Array のまま（string 化されていない）であることを確認
    expect(typeof received).not.toBe('string')
    expect(Buffer.isBuffer(received) || received instanceof Uint8Array).toBe(
      true,
    )
    await app.close()
  })
})

describe('OPTIONS /v1/transcribe preflight', () => {
  test('認証なしでも 200/204 + CORS ヘッダ（audio/wav preflight を壊さない）', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/transcribe',
      headers: {
        origin: 'http://100.65.114.98:8787',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,content-type',
      },
    })
    expect([200, 204]).toContain(res.statusCode)
    expect(res.headers['access-control-allow-origin']).toBeDefined()
    await app.close()
  })
})

describe('POST /v1/transcribe 異常系', () => {
  test('サイズ上限超過は 413', async () => {
    const app = makeApp(okFetch(), {
      TRANSCRIBE_MAX_BYTES: '1024',
    })
    const big = Buffer.alloc(2048, 1)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: big,
    })
    expect(res.statusCode).toBe(413)
    await app.close()
  })

  test('サイドカー不達は 502 + stt_unreachable', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    expect(res.statusCode).toBe(502)
    expect((res.json() as { error: string }).error).toBe('stt_unreachable')
    await app.close()
  })

  test('サイドカーが非2xx（500）でも 502 + stt_unreachable', async () => {
    // 実運用で最も起きやすい失敗（サイドカー起動済みだがエラー応答）の検証。
    const fetchImpl = (async () =>
      new Response('internal error', {
        status: 500,
      })) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    expect(res.statusCode).toBe(502)
    expect((res.json() as { error: string }).error).toBe('stt_unreachable')
    await app.close()
  })

  test('タイムアウト超過は 504 + stt_timeout', async () => {
    // abort されるまで解決しない fetch（STT_TIMEOUT_MS=50 で abort される）
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: WAV,
    })
    expect(res.statusCode).toBe(504)
    expect((res.json() as { error: string }).error).toBe('stt_timeout')
    await app.close()
  })

  test('空ボディは 400', async () => {
    const app = makeApp(okFetch())
    const res = await app.inject({
      method: 'POST',
      url: '/v1/transcribe',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'audio/wav',
      },
      payload: Buffer.alloc(0),
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })
})
