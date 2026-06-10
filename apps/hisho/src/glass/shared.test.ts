import { beforeAll, describe, expect, test } from 'bun:test'
import { getTextWidth } from '@evenrealities/pretext'
import { statusBarLines } from './shared'

// __APP_VERSION__ は Vite define（build 時）でのみ注入される。
// bun test は Vite を介さないため、build と同じ経路（globalThis）で供給して
// statusBarLines のバージョン表示配線を検証する。
beforeAll(() => {
  ;(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = '9.9.9'
})

// separator（'─'×27）と同じ右端。ステータスバーはこの幅に収める。
const BAR_WIDTH_PX = getTextWidth('─'.repeat(27))

describe('statusBarLines のバージョン表示（Phase 5.2・案A）', () => {
  // 最も幅の広い時計（2 桁月日・全角曜）でも version が押し出されないことを担保する
  const widestClock = new Date('2026-12-28T23:59:00')

  test('ステータスバー左に HISHO v<version> を省略なく含む', () => {
    const [bar] = statusBarLines(widestClock)
    expect(bar.text).toContain('HISHO v9.9.9')
  })

  test('時計（年月日・時刻）が欠けず残る', () => {
    const [bar] = statusBarLines(widestClock)
    expect(bar.text).toContain('2026年12月28日')
    expect(bar.text).toContain('23:59')
  })

  test('getTextWidth 実幅でバー幅 540px を超えない', () => {
    const [bar] = statusBarLines(widestClock)
    expect(getTextWidth(bar.text)).toBeLessThanOrEqual(BAR_WIDTH_PX)
  })
})
