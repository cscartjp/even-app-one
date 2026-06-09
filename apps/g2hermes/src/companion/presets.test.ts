import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_PRESETS,
  type Preset,
  parse,
  serialize,
  validatePreset,
} from './presets'

describe('DEFAULT_PRESETS', () => {
  test('現行4問をシードに持ち、各要素が検証を通る', () => {
    expect(DEFAULT_PRESETS).toHaveLength(4)
    expect(DEFAULT_PRESETS.map((p) => p.label)).toEqual([
      '自己紹介',
      '今できること',
      '豆知識',
      '今日の日付',
    ])
    for (const p of DEFAULT_PRESETS) {
      expect(validatePreset(p)).toBe(true)
    }
  })

  test('id は全件ユニーク', () => {
    const ids = DEFAULT_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('validatePreset', () => {
  const ok: Preset = { id: 'a', label: 'ラベル', text: 'プロンプト' }

  test('正常な preset を受理', () => {
    expect(validatePreset(ok)).toBe(true)
  })

  test('label の境界（1字 / 20字）を受理', () => {
    expect(validatePreset({ ...ok, label: 'あ' })).toBe(true)
    expect(validatePreset({ ...ok, label: 'あ'.repeat(20) })).toBe(true)
  })

  test('label 21字を reject', () => {
    expect(validatePreset({ ...ok, label: 'あ'.repeat(21) })).toBe(false)
  })

  test('text の境界（1字 / 2000字）を受理', () => {
    expect(validatePreset({ ...ok, text: 'あ' })).toBe(true)
    expect(validatePreset({ ...ok, text: 'あ'.repeat(2000) })).toBe(true)
  })

  test('text 2001字を reject', () => {
    expect(validatePreset({ ...ok, text: 'あ'.repeat(2001) })).toBe(false)
  })

  test('空 / 空白のみの label を reject', () => {
    expect(validatePreset({ ...ok, label: '' })).toBe(false)
    expect(validatePreset({ ...ok, label: '   ' })).toBe(false)
  })

  test('空 / 空白のみの text を reject', () => {
    expect(validatePreset({ ...ok, text: '' })).toBe(false)
    expect(validatePreset({ ...ok, text: '   ' })).toBe(false)
  })

  test('id 欠落 / 空 / 非文字列を reject', () => {
    expect(validatePreset({ label: 'x', text: 'y' })).toBe(false)
    expect(validatePreset({ ...ok, id: '' })).toBe(false)
    expect(validatePreset({ ...ok, id: 1 })).toBe(false)
  })

  test('preset 形でない値を reject', () => {
    expect(validatePreset(null)).toBe(false)
    expect(validatePreset('x')).toBe(false)
    expect(validatePreset({ id: 'a', label: 1, text: 'y' })).toBe(false)
  })
})

describe('serialize / parse round-trip', () => {
  test('正常な presets を round-trip できる', () => {
    const presets: Preset[] = [
      { id: '1', label: 'A', text: 'aaa' },
      { id: '2', label: 'B', text: 'bbb' },
    ]
    expect(parse(serialize(presets))).toEqual(presets)
  })

  test('DEFAULT_PRESETS を round-trip できる', () => {
    expect(parse(serialize(DEFAULT_PRESETS))).toEqual(DEFAULT_PRESETS)
  })

  test('8件（上限）を round-trip できる', () => {
    const presets: Preset[] = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      label: `L${i}`,
      text: `T${i}`,
    }))
    expect(parse(serialize(presets))).toEqual(presets)
  })
})

describe('parse のフォールバック（黙って壊さない）', () => {
  test('空文字列 → default seed', () => {
    expect(parse('')).toEqual(DEFAULT_PRESETS)
  })

  test('不正 JSON → default seed', () => {
    expect(parse('{not json')).toEqual(DEFAULT_PRESETS)
  })

  test('配列でない JSON → default seed', () => {
    expect(parse('{"id":"a"}')).toEqual(DEFAULT_PRESETS)
  })

  test('件数 0（空配列）→ default seed', () => {
    expect(parse('[]')).toEqual(DEFAULT_PRESETS)
  })

  test('件数超過（9件）→ default seed', () => {
    const nine = JSON.stringify(
      Array.from({ length: 9 }, (_, i) => ({
        id: String(i),
        label: `L${i}`,
        text: `T${i}`,
      })),
    )
    expect(parse(nine)).toEqual(DEFAULT_PRESETS)
  })

  test('検証落ち要素を含む → default seed', () => {
    const bad = JSON.stringify([
      { id: '1', label: 'ok', text: 'ok' },
      { id: '2', label: '', text: 'ng' },
    ])
    expect(parse(bad)).toEqual(DEFAULT_PRESETS)
  })

  test('重複 id を含む → default seed（key 衝突 / update・remove の多重適用を防ぐ）', () => {
    const dup = JSON.stringify([
      { id: 'same', label: 'A', text: 'aaa' },
      { id: 'same', label: 'B', text: 'bbb' },
    ])
    expect(parse(dup)).toEqual(DEFAULT_PRESETS)
  })

  test('フォールバックは DEFAULT_PRESETS の共有参照を返さない（誤変更防止）', () => {
    const got = parse('')
    expect(got).not.toBe(DEFAULT_PRESETS)
    got[0].label = '改変'
    expect(DEFAULT_PRESETS[0].label).toBe('自己紹介')
  })
})
