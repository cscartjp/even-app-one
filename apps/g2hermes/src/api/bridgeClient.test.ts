import { describe, expect, test } from 'bun:test'
import { isAskResult } from './bridgeClient'

/** text/pages は満たす最小ベース（audioUrl/speechText だけを可変にして検証する）。 */
const base = { text: 'こんにちは', pages: ['こんにちは'] }

describe('isAskResult — audioUrl / speechText 検証（CodeRabbit 指摘）', () => {
  test('正常形（audioUrl=null・speechText 無し）は true', () => {
    expect(isAskResult({ ...base, audioUrl: null })).toBe(true)
  })

  test('正常形（audioUrl=string・speechText=string）は true', () => {
    expect(
      isAskResult({ ...base, audioUrl: '/audio/x', speechText: '読み上げ文' }),
    ).toBe(true)
  })

  test('audioUrl 欠落は false（必須）', () => {
    expect(isAskResult({ ...base })).toBe(false)
  })

  test('audioUrl 不正型（number）は false', () => {
    expect(isAskResult({ ...base, audioUrl: 123 })).toBe(false)
  })

  test('speechText 不正型（number）は false', () => {
    expect(isAskResult({ ...base, audioUrl: null, speechText: 1 })).toBe(false)
  })

  test('text 欠落は false', () => {
    expect(isAskResult({ pages: [], audioUrl: null })).toBe(false)
  })

  test('pages が文字列配列でないと false', () => {
    expect(isAskResult({ text: 'x', pages: [1, 2], audioUrl: null })).toBe(
      false,
    )
  })
})
