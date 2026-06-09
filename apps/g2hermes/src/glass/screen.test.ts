import { describe, expect, test } from 'bun:test'
import { initialState, type State } from './reducer'
import { hermesScreen, thinkingSpinner, transcribingSpinner } from './screen'

const nav = { highlightedIndex: 0, screen: 'home' }
const snap = (over: Partial<State>) => ({
  ...initialState,
  presets: [],
  ...over,
})

describe('待ち時間スピナー glyph（Phase 4・純関数）', () => {
  test('thinkingSpinner は 8 方向矢印を frame で巡回', () => {
    const glyphs = [0, 1, 2, 3, 4, 5, 6, 7].map(thinkingSpinner)
    expect(glyphs).toEqual(['▲', '◥', '▶', '◢', '▼', '◣', '◀', '◤'])
    expect(thinkingSpinner(8)).toBe('▲') // 1 周してループ
  })

  test('transcribingSpinner は ● が左→右へ流れてループ', () => {
    expect(transcribingSpinner(0)).toBe('●────')
    expect(transcribingSpinner(2)).toBe('──●──')
    expect(transcribingSpinner(4)).toBe('────●')
    expect(transcribingSpinner(5)).toBe('●────') // ループ
  })
})

describe('display スピナー統合', () => {
  test('thinking 表示はスピナー矢印を行末に含む', () => {
    const { lines } = hermesScreen.display(
      snap({ phase: 'thinking', askingLabel: 'q', frame: 2 }),
      nav,
    )
    const joined = lines.map((l) => l.text).join('\n')
    expect(joined).toContain(thinkingSpinner(2))
    expect(joined).toContain('Thinking…')
  })

  test('transcribing 表示は frame で流れるドット行を含む', () => {
    const { lines } = hermesScreen.display(
      snap({ phase: 'transcribing', frame: 3 }),
      nav,
    )
    const joined = lines.map((l) => l.text).join('\n')
    expect(joined).toContain(transcribingSpinner(3))
    expect(joined).toContain('文字起こし中…')
  })

  test('recording 表示は静的 REC ●（frame 非依存・無改変回帰）', () => {
    const a = hermesScreen.display(snap({ phase: 'recording', frame: 0 }), nav)
    const b = hermesScreen.display(snap({ phase: 'recording', frame: 99 }), nav)
    expect(a).toEqual(b)
    const joined = a.lines.map((l) => l.text).join('\n')
    expect(joined).toContain('REC ●')
  })
})
