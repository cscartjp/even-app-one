import { describe, expect, test } from 'bun:test'
import {
  addPreset,
  canPersist,
  movePreset,
  removePreset,
  updatePreset,
} from './editor'
import { PRESET_MAX, PRESET_MIN, type Preset } from './presets'

/** テスト用の最小プリセット列を作る。 */
function makePresets(n: number): Preset[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${i}`,
    label: `L${i}`,
    text: `T${i}`,
  }))
}

describe('addPreset', () => {
  test('末尾に空ラベル/空プロンプトの新規プリセットを採番 id で1件足す', () => {
    const before = makePresets(2)
    const after = addPreset(before, 'new-id')
    expect(after).toHaveLength(3)
    expect(after[2]).toEqual({ id: 'new-id', label: '', text: '' })
    // 既存要素は不変
    expect(after.slice(0, 2)).toEqual(before)
  })

  test('元配列を破壊しない（新しい配列を返す）', () => {
    const before = makePresets(1)
    const after = addPreset(before, 'x')
    expect(after).not.toBe(before)
    expect(before).toHaveLength(1)
  })

  test('上限（PRESET_MAX 件）に達している場合は追加せず元配列を返す', () => {
    const full = makePresets(PRESET_MAX)
    const after = addPreset(full, 'overflow')
    expect(after).toHaveLength(PRESET_MAX)
    expect(after.some((p) => p.id === 'overflow')).toBe(false)
  })
})

describe('updatePreset', () => {
  test('指定 id の label を更新し他要素は不変', () => {
    const before = makePresets(3)
    const after = updatePreset(before, 'id-1', { label: '更新後' })
    expect(after[1]).toEqual({ id: 'id-1', label: '更新後', text: 'T1' })
    expect(after[0]).toEqual(before[0])
    expect(after[2]).toEqual(before[2])
  })

  test('label と text を同時に部分更新できる', () => {
    const before = makePresets(1)
    const after = updatePreset(before, 'id-0', { label: 'A', text: 'B' })
    expect(after[0]).toEqual({ id: 'id-0', label: 'A', text: 'B' })
  })

  test('検証途中の不正値（空文字）も保持する＝編集中は弾かない', () => {
    const before = makePresets(1)
    const after = updatePreset(before, 'id-0', { label: '' })
    expect(after[0].label).toBe('')
  })

  test('存在しない id は何も変えず元と同値の配列を返す', () => {
    const before = makePresets(2)
    const after = updatePreset(before, 'missing', { label: 'x' })
    expect(after).toEqual(before)
  })

  test('元配列を破壊しない', () => {
    const before = makePresets(1)
    updatePreset(before, 'id-0', { label: 'changed' })
    expect(before[0].label).toBe('L0')
  })
})

describe('removePreset', () => {
  test('指定 id を削除する', () => {
    const before = makePresets(3)
    const after = removePreset(before, 'id-1')
    expect(after.map((p) => p.id)).toEqual(['id-0', 'id-2'])
  })

  test('下限（PRESET_MIN 件）の時は削除せず元配列を返す', () => {
    const min = makePresets(PRESET_MIN)
    const after = removePreset(min, min[0].id)
    expect(after).toHaveLength(PRESET_MIN)
    expect(after).toEqual(min)
  })

  test('元配列を破壊しない', () => {
    const before = makePresets(2)
    removePreset(before, 'id-0')
    expect(before).toHaveLength(2)
  })
})

describe('movePreset', () => {
  test('up で1つ前と入れ替える', () => {
    const before = makePresets(3)
    const after = movePreset(before, 2, 'up')
    expect(after.map((p) => p.id)).toEqual(['id-0', 'id-2', 'id-1'])
  })

  test('down で1つ後と入れ替える', () => {
    const before = makePresets(3)
    const after = movePreset(before, 0, 'down')
    expect(after.map((p) => p.id)).toEqual(['id-1', 'id-0', 'id-2'])
  })

  test('先頭を up しても変わらない（端）', () => {
    const before = makePresets(3)
    expect(movePreset(before, 0, 'up')).toEqual(before)
  })

  test('末尾を down しても変わらない（端）', () => {
    const before = makePresets(3)
    expect(movePreset(before, 2, 'down')).toEqual(before)
  })

  test('範囲外 index は何も変えない', () => {
    const before = makePresets(2)
    expect(movePreset(before, 5, 'up')).toEqual(before)
    expect(movePreset(before, -1, 'down')).toEqual(before)
  })

  test('元配列を破壊しない', () => {
    const before = makePresets(3)
    movePreset(before, 0, 'down')
    expect(before.map((p) => p.id)).toEqual(['id-0', 'id-1', 'id-2'])
  })
})

describe('canPersist（検証反映: 不正リストの保存を拒否）', () => {
  test('全要素が検証を通り件数も範囲内なら true', () => {
    expect(canPersist(makePresets(3))).toBe(true)
  })

  test('空ラベルを含むと false（保存保留）', () => {
    const list = makePresets(2)
    list[1] = { ...list[1], label: '' }
    expect(canPersist(list)).toBe(false)
  })

  test('空プロンプトを含むと false', () => {
    const list = makePresets(1)
    list[0] = { ...list[0], text: '   ' }
    expect(canPersist(list)).toBe(false)
  })

  test('ラベル超過（21字）を含むと false', () => {
    const list = makePresets(1)
    list[0] = { ...list[0], label: 'あ'.repeat(21) }
    expect(canPersist(list)).toBe(false)
  })

  test('件数 0（下限割れ）は false', () => {
    expect(canPersist([])).toBe(false)
  })

  test('件数超過（PRESET_MAX+1）は false', () => {
    expect(canPersist(makePresets(PRESET_MAX + 1))).toBe(false)
  })
})
