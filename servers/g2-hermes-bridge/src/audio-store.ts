import { randomBytes } from 'node:crypto'

/** キャッシュ 1 件。WAV 本体・失効時刻（epoch ms）・byte 数。 */
export interface AudioEntry {
  buf: Buffer
  expiresAt: number
  bytes: number
}

/** WAV の in-memory TTL キャッシュ。capability id（256bit random）で引く。 */
export interface AudioStore {
  /** WAV を格納し capability id（base64url）を返す。三重上限超過は古い順 evict。 */
  put(buf: Buffer): string
  /** id で引く。未知・期限切れは null（期限切れは同時に削除する）。 */
  get(id: string): AudioEntry | null
  /** 現在の保持件数。 */
  readonly size: number
  /** 現在の保持総 byte。 */
  readonly totalBytes: number
}

export interface AudioStoreOptions {
  ttlSeconds: number
  maxEntries: number
  maxBytes: number
  /** 現在時刻（epoch ms）。TTL テスト用に注入する。既定 `Date.now`。 */
  now?: () => number
  /** id 生成。既定は 256bit random の base64url。テストで固定する用途。 */
  genId?: () => string
}

/**
 * WAV を保持する in-memory TTL キャッシュを作る。
 * 退避は TTL（失効）＋ 件数上限＋ 総 byte 上限の三重で、超過分を **挿入が古い順**に evict する
 * （Map の反復順 = 挿入順を利用）。Range 再生で複数回読まれるため、再生後に即削除はしない。
 */
export function createAudioStore(opts: AudioStoreOptions): AudioStore {
  const now = opts.now ?? Date.now
  const genId = opts.genId ?? (() => randomBytes(32).toString('base64url'))
  const ttlMs = opts.ttlSeconds * 1000
  const map = new Map<string, AudioEntry>()
  let totalBytes = 0

  /** 1 件削除して総 byte を補正する。 */
  function remove(id: string): void {
    const e = map.get(id)
    if (!e) return
    map.delete(id)
    totalBytes -= e.bytes
  }

  /** 期限切れを掃除する。 */
  function sweepExpired(t: number): void {
    for (const [id, e] of map) {
      if (e.expiresAt <= t) remove(id)
    }
  }

  /** 件数 / 総 byte が上限内に収まるまで最古から evict する。 */
  function evictToLimits(): void {
    while (map.size > opts.maxEntries || totalBytes > opts.maxBytes) {
      const oldest = map.keys().next().value
      if (oldest === undefined) break
      remove(oldest)
    }
  }

  return {
    put(buf: Buffer): string {
      const t = now()
      sweepExpired(t)
      const id = genId()
      const entry: AudioEntry = {
        buf,
        expiresAt: t + ttlMs,
        bytes: buf.byteLength,
      }
      map.set(id, entry)
      totalBytes += entry.bytes
      evictToLimits()
      return id
    },

    get(id: string): AudioEntry | null {
      const e = map.get(id)
      if (!e) return null
      if (e.expiresAt <= now()) {
        remove(id)
        return null
      }
      return e
    },

    get size() {
      return map.size
    },
    get totalBytes() {
      return totalBytes
    },
  }
}
