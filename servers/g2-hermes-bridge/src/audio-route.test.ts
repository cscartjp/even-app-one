import { describe, expect, test } from 'bun:test'
import { createAudioStore } from './audio-store'
import { loadConfig } from './config'
import { buildServer } from './server'

const TOKEN = 'test-token'
const WAV = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 5, 6]) // "RIFF"+payload, 10 bytes

/** WAV を 1 件 seed 済みの Bridge を作り、その id を返す。 */
function makeAppWithAudio() {
  const config = loadConfig({ BRIDGE_TOKEN: TOKEN })
  const audioStore = createAudioStore({
    ttlSeconds: 300,
    maxEntries: 100,
    maxBytes: 1_000_000,
  })
  const id = audioStore.put(WAV)
  const app = buildServer({ config, audioStore, logger: false })
  return { app, id }
}

describe('GET /audio/:id 配信', () => {
  test('Bearer 無しでも動的 id を 200 で配信する（prefix 除外が動的 id に効く）', async () => {
    const { app, id } = makeAppWithAudio()
    const res = await app.inject({ method: 'GET', url: `/audio/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('audio/wav')
    expect(res.headers['cache-control']).toBe('no-store, private')
    expect(res.headers['accept-ranges']).toBe('bytes')
    expect(res.headers['content-length']).toBe(String(WAV.byteLength))
    expect(Buffer.from(res.rawPayload).equals(WAV)).toBe(true)
    await app.close()
  })

  test('HEAD は本文無し + ヘッダ', async () => {
    const { app, id } = makeAppWithAudio()
    const res = await app.inject({ method: 'HEAD', url: `/audio/${id}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('audio/wav')
    expect(res.headers['content-length']).toBe(String(WAV.byteLength))
    expect(res.rawPayload.length).toBe(0)
    await app.close()
  })

  test('Range で 206 + Content-Range + 部分本文', async () => {
    const { app, id } = makeAppWithAudio()
    const res = await app.inject({
      method: 'GET',
      url: `/audio/${id}`,
      headers: { range: 'bytes=0-3' },
    })
    expect(res.statusCode).toBe(206)
    expect(res.headers['content-range']).toBe(`bytes 0-3/${WAV.byteLength}`)
    expect(res.headers['content-length']).toBe('4')
    expect(Buffer.from(res.rawPayload).equals(WAV.subarray(0, 4))).toBe(true)
    await app.close()
  })

  test('不正 Range は 416 + Content-Range bytes */len', async () => {
    const { app, id } = makeAppWithAudio()
    const res = await app.inject({
      method: 'GET',
      url: `/audio/${id}`,
      headers: { range: 'bytes=999-1000' },
    })
    expect(res.statusCode).toBe(416)
    expect(res.headers['content-range']).toBe(`bytes */${WAV.byteLength}`)
    await app.close()
  })

  test('未知 id は 404', async () => {
    const { app } = makeAppWithAudio()
    const res = await app.inject({ method: 'GET', url: '/audio/unknown-id' })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  test('GET/HEAD 以外（POST）は 405', async () => {
    const { app, id } = makeAppWithAudio()
    const res = await app.inject({ method: 'POST', url: `/audio/${id}` })
    expect(res.statusCode).toBe(405)
    expect(res.headers.allow).toBe('GET, HEAD')
    await app.close()
  })
})
