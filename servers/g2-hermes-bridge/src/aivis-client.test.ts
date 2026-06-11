import { describe, expect, test } from 'bun:test'
import {
  AivisTimeoutError,
  AivisUnreachableError,
  synthesizeWav,
} from './aivis-client'
import { loadConfig } from './config'

/** Aivis 連携の最小 config。timeout は env で短くしてタイムアウト分岐を固定する。 */
function makeConfig(env: NodeJS.ProcessEnv = {}) {
  return loadConfig({
    AIVIS_BASE_URL: 'http://aivis.test:10101',
    AIVIS_SPEAKER_ID: '888753760',
    ...env,
  })
}

/** `/audio_query` の query JSON 相当（中身は不透明・そのまま /synthesis に渡る）。 */
function queryResponse(): Response {
  return new Response(JSON.stringify({ accent_phrases: [], speedScale: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** `/synthesis` の WAV 相当（先頭 4 バイト `RIFF` で WAV を模す）。 */
function wavResponse(bytes: Uint8Array): Response {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': 'audio/wav' },
  })
}

const FAKE_WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]) // "RIFF"+payload

describe('synthesizeWav 正常系', () => {
  test('audio_query→synthesis を順に叩き WAV Buffer を返す', async () => {
    const calls: Array<{ url: string; method: string; body: unknown }> = []
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body,
      })
      if (String(url).includes('/audio_query')) return queryResponse()
      return wavResponse(FAKE_WAV)
    }) as unknown as typeof fetch

    const wav = await synthesizeWav(
      { config: makeConfig(), fetchImpl },
      'こんにちは',
    )

    expect(Buffer.isBuffer(wav)).toBe(true)
    expect(Buffer.from(FAKE_WAV).equals(wav)).toBe(true)

    // 1 回目: /audio_query?text=...&speaker=...（POST・text は URL エンコード済み）
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.url).toContain('http://aivis.test:10101/audio_query')
    expect(calls[0]?.url).toContain(`text=${encodeURIComponent('こんにちは')}`)
    expect(calls[0]?.url).toContain('speaker=888753760')

    // 2 回目: /synthesis?speaker=...（POST・body は audio_query の JSON をそのまま）
    expect(calls[1]?.method).toBe('POST')
    expect(calls[1]?.url).toContain('http://aivis.test:10101/synthesis')
    expect(calls[1]?.url).toContain('speaker=888753760')
    expect(JSON.parse(String(calls[1]?.body))).toEqual({
      accent_phrases: [],
      speedScale: 1,
    })
  })
})

describe('synthesizeWav 異常系（型付きエラー）', () => {
  test('audio_query が非200 なら AivisUnreachableError（synthesis は呼ばない）', async () => {
    let synthesisCalled = false
    const fetchImpl = (async (url: string | URL) => {
      if (String(url).includes('/synthesis')) {
        synthesisCalled = true
        return wavResponse(FAKE_WAV)
      }
      return new Response('boom', { status: 500 })
    }) as unknown as typeof fetch

    await expect(
      synthesizeWav({ config: makeConfig(), fetchImpl }, 'x'),
    ).rejects.toBeInstanceOf(AivisUnreachableError)
    expect(synthesisCalled).toBe(false)
  })

  test('synthesis が非200 なら AivisUnreachableError', async () => {
    const fetchImpl = (async (url: string | URL) => {
      if (String(url).includes('/audio_query')) return queryResponse()
      return new Response('err', { status: 503 })
    }) as unknown as typeof fetch

    await expect(
      synthesizeWav({ config: makeConfig(), fetchImpl }, 'x'),
    ).rejects.toBeInstanceOf(AivisUnreachableError)
  })

  test('fetch 不達は AivisUnreachableError', async () => {
    const fetchImpl = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch

    await expect(
      synthesizeWav({ config: makeConfig(), fetchImpl }, 'x'),
    ).rejects.toBeInstanceOf(AivisUnreachableError)
  })

  test('timeout 超過は AivisTimeoutError（abort されるまで解決しない fetch）', async () => {
    const fetchImpl = ((_url: string | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })) as unknown as typeof fetch

    await expect(
      synthesizeWav(
        { config: makeConfig({ AIVIS_QUERY_TIMEOUT_MS: '20' }), fetchImpl },
        'x',
      ),
    ).rejects.toBeInstanceOf(AivisTimeoutError)
  })
})
