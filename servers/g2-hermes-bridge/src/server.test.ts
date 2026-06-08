import { describe, expect, test } from 'bun:test'
import { loadConfig } from './config'
import { buildServer } from './server'

const TOKEN = 'test-token'

function makeApp(fetchImpl?: typeof fetch) {
  const config = loadConfig({
    BRIDGE_TOKEN: TOKEN,
    HERMES_BASE_URL: 'http://hermes.test/v1',
    HERMES_API_KEY: 'k',
    HERMES_TIMEOUT_MS: '50',
  })
  return buildServer({ config, fetchImpl, logger: false })
}

/** message + function_call が混在する Hermes レスポンス相当（id 付き）。 */
function hermesResponse(id: string, text: string): Response {
  const body = {
    id,
    output: [
      { type: 'function_call', name: 'get_schedule', arguments: '{}' },
      { type: 'message', content: [{ type: 'output_text', text }] },
    ],
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /v1/ask 認証', () => {
  test('トークン無しは 401', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  test('誤ったトークンは 401', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: 'Bearer wrong' },
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })

  test('スキーム大小・余分な空白を許容して認証を通す', async () => {
    const app = makeApp()
    // 認証を通れば zod で 400（text 空）になる。401 にならないこと＝認証通過の確認。
    for (const authorization of [
      `bearer ${TOKEN}`,
      `Bearer  ${TOKEN}`,
      `  Bearer ${TOKEN}  `,
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/ask',
        headers: { authorization },
        payload: { sessionId: 's', text: '' },
      })
      expect(res.statusCode).toBe(400)
    }
    await app.close()
  })

  test('スキーム無し（トークンのみ）は 401', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: TOKEN },
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('POST /v1/ask 正常系（Hermes はモック）', () => {
  test('正規トークンで 200・本文抽出・pages を返す', async () => {
    const fetchImpl = (async () =>
      hermesResponse(
        'resp_1',
        'こんにちは、Hermesです。',
      )) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { sessionId: 's', text: 'こんにちは' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      ok: boolean
      responseId: string
      text: string
      pages: string[]
      audioUrl: null
    }
    expect(body.ok).toBe(true)
    expect(body.responseId).toBe('resp_1')
    expect(body.text).toBe('こんにちは、Hermesです。')
    expect(body.pages.length).toBeGreaterThanOrEqual(1)
    expect(body.pages.every((p) => p.length <= 90)).toBe(true)
    expect(body.audioUrl).toBeNull()
    await app.close()
  })

  test('previous_response_id で2ターン目の会話が継続する', async () => {
    const sentBodies: Array<Record<string, unknown>> = []
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      sentBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return hermesResponse(`resp_${sentBodies.length}`, 'ok')
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const headers = { authorization: `Bearer ${TOKEN}` }
    await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers,
      payload: { sessionId: 's', text: '1' },
    })
    await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers,
      payload: { sessionId: 's', text: '2' },
    })
    expect(sentBodies[0]?.previous_response_id).toBeUndefined()
    expect(sentBodies[1]?.previous_response_id).toBe('resp_1')
    await app.close()
  })
})

describe('POST /v1/ask 異常系', () => {
  test('不正ボディ（text 欠落）は 400', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { sessionId: 's' },
    })
    expect(res.statusCode).toBe(400)
    await app.close()
  })

  test('Hermes 不達は 502 + hermes_unreachable', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(502)
    expect((res.json() as { error: string }).error).toBe('hermes_unreachable')
    await app.close()
  })

  test('タイムアウト超過は 504 + hermes_timeout', async () => {
    // abort されるまで解決しない fetch（HERMES_TIMEOUT_MS=50 で abort される）
    const fetchImpl = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(504)
    expect((res.json() as { error: string }).error).toBe('hermes_timeout')
    await app.close()
  })

  test('headers 後に body が詰まってもタイムアウトで 504（body 読取中の abort）', async () => {
    // fetch は headers で即解決するが、json()(body) が abort まで解決しない。
    // タイマーを fetch 解決時に解除していると無限待ちになる回帰を防ぐ。
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      const res = {
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      }
      return Promise.resolve(res as unknown as Response)
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: { authorization: `Bearer ${TOKEN}` },
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(504)
    expect((res.json() as { error: string }).error).toBe('hermes_timeout')
    await app.close()
  })
})

describe('OPTIONS /v1/ask preflight', () => {
  test('認証なしでも 200/204 + CORS ヘッダ（preflight を壊さない）', async () => {
    const app = makeApp()
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/v1/ask',
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

describe('GET /health', () => {
  test('認証なしで 200・version・hermes 到達性を返す', async () => {
    const fetchImpl = (async () =>
      new Response('{}', { status: 200 })) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { ok: boolean; version: string; hermes: string }
    expect(body.ok).toBe(true)
    expect(body.version).toBe('0.1.0')
    expect(body.hermes).toBe('reachable')
    await app.close()
  })

  test('Hermes 不達時は hermes=unreachable（/health 自体は 200）', async () => {
    const fetchImpl = (async () => {
      throw new Error('down')
    }) as unknown as typeof fetch
    const app = makeApp(fetchImpl)
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { hermes: string }).hermes).toBe('unreachable')
    await app.close()
  })
})
