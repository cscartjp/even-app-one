import { describe, expect, test } from 'bun:test'
import { loadConfig } from './config'
import { buildServer } from './server'

const TOKEN = 'test-token'
const FAKE_WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4])

/** Hermes `/responses` 応答（id + 本文）。 */
function hermesResponse(id: string, text: string): Response {
  return new Response(
    JSON.stringify({
      id,
      output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

interface MockState {
  aivisCalls: number
  queryText: string | null
}

/**
 * Hermes + Aivis をモックした Bridge を作る。
 * `answerText` を Hermes 回答に、`aivisOk=false` で /synthesis を 500 にする。
 */
function makeApp(opts: {
  answerText: string
  aivisOk?: boolean
  env?: NodeJS.ProcessEnv
}) {
  const { answerText, aivisOk = true } = opts
  const state: MockState = { aivisCalls: 0, queryText: null }
  const fetchImpl = (async (url: string | URL, _init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/responses')) return hermesResponse('resp_1', answerText)
    if (u.includes('/audio_query')) {
      state.aivisCalls++
      const text = new URL(u).searchParams.get('text')
      state.queryText = text
      return new Response(JSON.stringify({ q: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    if (u.includes('/synthesis')) {
      state.aivisCalls++
      if (!aivisOk) return new Response('err', { status: 500 })
      return new Response(FAKE_WAV, {
        status: 200,
        headers: { 'content-type': 'audio/wav' },
      })
    }
    throw new Error(`unexpected url: ${u}`)
  }) as unknown as typeof fetch

  const config = loadConfig({
    BRIDGE_TOKEN: TOKEN,
    HERMES_BASE_URL: 'http://hermes.test/v1',
    HERMES_API_KEY: 'k',
    AIVIS_BASE_URL: 'http://aivis.test:10101',
    ...opts.env,
  })
  const app = buildServer({ config, fetchImpl, logger: false })
  return { app, state }
}

const auth = { authorization: `Bearer ${TOKEN}` }

describe('POST /v1/ask TTS 配線', () => {
  test('tts:true で audioUrl=/audio/<id> と speechText が付き、その URL で WAV を配信', async () => {
    const { app } = makeApp({ answerText: 'こんにちは' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: auth,
      payload: { sessionId: 's', text: 'hi', tts: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { audioUrl: string; speechText: string }
    expect(body.speechText).toBe('こんにちは')
    expect(body.audioUrl).toMatch(/^\/audio\/[A-Za-z0-9_-]{43}$/)

    // 払い出された audioUrl を Bearer 無しで GET → 同一 WAV
    const audio = await app.inject({ method: 'GET', url: body.audioUrl })
    expect(audio.statusCode).toBe(200)
    expect(audio.headers['content-type']).toBe('audio/wav')
    expect(Buffer.from(audio.rawPayload).equals(Buffer.from(FAKE_WAV))).toBe(
      true,
    )
    await app.close()
  })

  test('tts:false は audioUrl=null・speechText 無し・Aivis 未呼び出し（現行等価）', async () => {
    const { app, state } = makeApp({ answerText: 'こんにちは' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: auth,
      payload: { sessionId: 's', text: 'hi', tts: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { audioUrl: null; speechText?: string }
    expect(body.audioUrl).toBeNull()
    expect(body.speechText).toBeUndefined()
    expect(state.aivisCalls).toBe(0)
    await app.close()
  })

  test('tts 省略時も現行等価（audioUrl=null・Aivis 未呼び出し）', async () => {
    const { app, state } = makeApp({ answerText: 'やあ' })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: auth,
      payload: { sessionId: 's', text: 'hi' },
    })
    expect(res.statusCode).toBe(200)
    expect((res.json() as { audioUrl: null }).audioUrl).toBeNull()
    expect(state.aivisCalls).toBe(0)
    await app.close()
  })

  test('Aivis 失敗でも 200 + text 維持、audioUrl は null に降格', async () => {
    const { app } = makeApp({ answerText: 'これはテスト回答', aivisOk: false })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: auth,
      payload: { sessionId: 's', text: 'hi', tts: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { text: string; audioUrl: null }
    expect(body.text).toBe('これはテスト回答')
    expect(body.audioUrl).toBeNull()
    await app.close()
  })

  test('speechText は TTS_MAX_CHARS で切り詰められ、その文字で audio_query を叩く', async () => {
    const { app, state } = makeApp({
      answerText: 'あいうえおかきくけこ', // 10 文字
      env: { TTS_MAX_CHARS: '5' },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/v1/ask',
      headers: auth,
      payload: { sessionId: 's', text: 'hi', tts: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { speechText: string }
    expect(body.speechText).toBe('あいうえお')
    expect(state.queryText).toBe('あいうえお')
    await app.close()
  })
})
