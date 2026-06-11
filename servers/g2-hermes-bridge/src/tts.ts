/**
 * 読み上げ用にテキストを最大文字数で短縮する純関数。
 * 初期実装は「表示用 text をそのまま maxChars で切り詰める」だけ（spec の speechText=短縮版）。
 * code point 単位で数える（絵文字等のサロゲートペアを途中で割らない）。前後空白は trim する。
 */
export function shortenForSpeech(text: string, maxChars: number): string {
  const trimmed = text.trim()
  const cp = Array.from(trimmed)
  return cp.length <= maxChars ? trimmed : cp.slice(0, maxChars).join('')
}

/** 同時実行数を制限する軽量リミッタ。 */
export interface Limiter {
  /** `fn` を上限内で実行する。上限到達中は順番待ちして空き次第走る。 */
  run<T>(fn: () => Promise<T>): Promise<T>
}

/**
 * 同時実行を `max` 本に絞るリミッタを作る（Aivis /synthesis は重いため）。
 * 上限到達中の呼び出しは FIFO キューに積み、走っているジョブが終わるたび 1 本ずつ起動する。
 */
export function createLimiter(max: number): Limiter {
  let active = 0
  const queue: Array<() => void> = []

  const release = () => {
    active--
    const job = queue.shift()
    if (job) job()
  }

  return {
    run<T>(fn: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const start = () => {
          active++
          fn().then(resolve, reject).finally(release)
        }
        if (active < max) start()
        else queue.push(start)
      })
    },
  }
}
