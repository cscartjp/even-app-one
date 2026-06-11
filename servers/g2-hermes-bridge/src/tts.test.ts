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

  test('fn が同期 throw しても active が戻り後続ジョブが実行される（デッドロック回避）', async () => {
    const limiter = createLimiter(1) // 1 本ずつ＝同期 throw で詰まると後続が永久に走らない
    const ran: string[] = []
    const p1 = limiter
      .run(() => {
        throw new Error('sync boom')
      })
      .catch(() => ran.push('p1-rejected'))
    const p2 = limiter.run(async () => {
      ran.push('p2-ran')
    })
    await Promise.all([p1, p2])
    expect(ran).toContain('p1-rejected')
    expect(ran).toContain('p2-ran')
  })

  test('同期 throw は呼び出し元へ reject として伝播する', async () => {
    const limiter = createLimiter(2)
    await expect(
      limiter.run(() => {
        throw new Error('sync boom')
      }),
    ).rejects.toThrow('sync boom')
  })

  test('max<=0 でもデッドロックせず実行される（1 に丸め）', async () => {
    expect(await createLimiter(0).run(async () => 42)).toBe(42)
  })
})
