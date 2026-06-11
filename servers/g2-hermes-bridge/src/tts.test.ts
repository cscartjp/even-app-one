import { describe, expect, test } from 'bun:test'
import { createLimiter, shortenForSpeech } from './tts'

describe('shortenForSpeech', () => {
  test('maxChars 以内はそのまま（trim のみ）', () => {
    expect(shortenForSpeech('  こんにちは  ', 10)).toBe('こんにちは')
  })

  test('maxChars 超過は切り詰める', () => {
    expect(shortenForSpeech('あいうえおかきくけこ', 5)).toBe('あいうえお')
  })

  test('サロゲートペアを途中で割らない', () => {
    // 絵文字 3 つを 2 文字に切り詰め → 壊れた半端文字が残らない
    expect(shortenForSpeech('😀😁😂', 2)).toBe('😀😁')
  })
})

describe('createLimiter', () => {
  test('同時実行が上限を超えない（max=2 で 3 本投入）', async () => {
    const limiter = createLimiter(2)
    let active = 0
    let peak = 0
    const job = () =>
      limiter.run(async () => {
        active++
        peak = Math.max(peak, active)
        await new Promise((r) => setTimeout(r, 10))
        active--
      })
    await Promise.all([job(), job(), job()])
    expect(peak).toBe(2)
  })

  test('全ジョブが完走し結果を返す', async () => {
    const limiter = createLimiter(2)
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) => limiter.run(async () => n * 2)),
    )
    expect(results).toEqual([2, 4, 6, 8])
  })
})
