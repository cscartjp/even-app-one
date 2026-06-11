import { describe, expect, test } from 'bun:test'
import { createAudioStore } from './audio-store'

const buf = (s: string) => Buffer.from(s, 'utf8')

describe('createAudioStore — 基本', () => {
  test('put→get で同一 Buffer を返し、id は base64url（推測不能長）', () => {
    const store = createAudioStore({
      ttlSeconds: 300,
      maxEntries: 100,
      maxBytes: 1_000_000,
    })
    const id = store.put(buf('RIFFwav'))
    // 256bit を base64url 化した長さ（= 43 文字・URL 安全文字のみ）
    expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const got = store.get(id as string)
    expect(got?.buf.toString('utf8')).toBe('RIFFwav')
    expect(got?.bytes).toBe(7)
  })

  test('未知 id は null', () => {
    const store = createAudioStore({
      ttlSeconds: 300,
      maxEntries: 100,
      maxBytes: 1_000_000,
    })
    expect(store.get('nope')).toBeNull()
  })
})

describe('createAudioStore — TTL', () => {
  test('TTL 超過で get は null（注入クロックで固定）', () => {
    let now = 1000
    const store = createAudioStore({
      ttlSeconds: 10,
      maxEntries: 100,
      maxBytes: 1_000_000,
      now: () => now,
    })
    const id = store.put(buf('x')) as string
    now = 1000 + 9_999 // TTL 内
    expect(store.get(id)).not.toBeNull()
    now = 1000 + 10_000 // TTL 到達
    expect(store.get(id)).toBeNull()
  })
})

describe('createAudioStore — 三重上限で古い順 evict', () => {
  test('件数上限超過で最古を evict', () => {
    const store = createAudioStore({
      ttlSeconds: 300,
      maxEntries: 2,
      maxBytes: 1_000_000,
    })
    const a = store.put(buf('a')) as string
    const b = store.put(buf('b')) as string
    const c = store.put(buf('c')) as string // a を押し出す
    expect(store.get(a)).toBeNull()
    expect(store.get(b)).not.toBeNull()
    expect(store.get(c)).not.toBeNull()
    expect(store.size).toBe(2)
  })

  test('総 byte 上限超過で最古から evict', () => {
    const store = createAudioStore({
      ttlSeconds: 300,
      maxEntries: 100,
      maxBytes: 10,
    })
    const a = store.put(Buffer.alloc(6)) // 6
    const b = store.put(Buffer.alloc(6)) // 6+6=12 > 10 → a を evict
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(store.get(a as string)).toBeNull()
    expect(store.get(b as string)).not.toBeNull()
    expect(store.totalBytes).toBe(6)
  })

  test('単体で総 byte 上限を超える WAV は保持せず null を返す（直後 404 を避ける）', () => {
    const store = createAudioStore({
      ttlSeconds: 300,
      maxEntries: 100,
      maxBytes: 5,
    })
    expect(store.put(Buffer.alloc(6))).toBeNull()
    expect(store.size).toBe(0)
    expect(store.totalBytes).toBe(0)
  })
})
