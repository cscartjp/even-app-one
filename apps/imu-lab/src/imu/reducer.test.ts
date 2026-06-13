import { describe, expect, test } from 'bun:test'
import type { ImuSample } from './math'
import {
  type Action,
  initialState,
  LOG_MAX,
  type ReducerState,
  reduce,
} from './reducer'

function feed(state: ReducerState, actions: Action[]): ReducerState {
  return actions.reduce(reduce, state)
}

const sample = (t: number, x: number, y: number, z: number): ImuSample => ({
  t,
  x,
  y,
  z,
})

describe('reduce', () => {
  test('SAMPLE で latest/count/log が更新される', () => {
    const s = feed(initialState, [
      { type: 'SAMPLE', sample: sample(0, 0, 0, 1) },
      { type: 'SAMPLE', sample: sample(100, 0, 0, 1) },
    ])
    expect(s.sampleCount).toBe(2)
    expect(s.latest).toEqual(sample(100, 0, 0, 1))
    expect(s.log).toHaveLength(2)
  })

  test('smoothed は窓内サンプルの平均', () => {
    const s = feed(initialState, [
      { type: 'SAMPLE', sample: sample(0, 0, 0, 2) },
      { type: 'SAMPLE', sample: sample(100, 0, 0, 4) },
    ])
    expect(s.smoothed).toEqual({ x: 0, y: 0, z: 3 })
  })

  test('古い（窓外）サンプルは平滑から外れる', () => {
    const s = feed(initialState, [
      { type: 'SAMPLE', sample: sample(0, 9, 9, 9) }, // 窓外になる
      { type: 'SAMPLE', sample: sample(2000, 0, 0, 1) },
    ])
    // t=0 は t=2000 から 1500ms 窓の外 → 平均は最新のみ
    expect(s.smoothed).toEqual({ x: 0, y: 0, z: 1 })
    // ただし log には全件残る
    expect(s.log).toHaveLength(2)
  })

  test('CALIBRATE は現在の平滑値を基準に取る', () => {
    const s = feed(initialState, [
      { type: 'SAMPLE', sample: sample(0, 0, 0, 2) },
      { type: 'SAMPLE', sample: sample(100, 0, 0, 4) },
      { type: 'CALIBRATE' },
    ])
    expect(s.calib).toEqual({ x: 0, y: 0, z: 3 })
  })

  test('サンプル皆無で CALIBRATE しても落ちない（calib は null のまま）', () => {
    const s = reduce(initialState, { type: 'CALIBRATE' })
    expect(s.calib).toBeNull()
  })

  test('START は計測フラグと開始時バッテリーを記録', () => {
    const s = reduce(initialState, { type: 'START', pace: 500, battery: 80 })
    expect(s.measuring).toBe(true)
    expect(s.pace).toBe(500)
    expect(s.batteryAtStart).toBe(80)
  })

  test('STOP で計測フラグ解除・レート 0', () => {
    const s = feed(initialState, [
      { type: 'START', pace: 100, battery: 80 },
      { type: 'SAMPLE', sample: sample(0, 0, 0, 1) },
      { type: 'STOP' },
    ])
    expect(s.measuring).toBe(false)
    expect(s.rateHz).toBe(0)
  })

  test('CLEAR でログと派生値がリセット（calib は保持）', () => {
    const s = feed(initialState, [
      { type: 'SAMPLE', sample: sample(0, 0, 0, 1) },
      { type: 'CALIBRATE' },
      { type: 'CLEAR' },
    ])
    expect(s.log).toHaveLength(0)
    expect(s.sampleCount).toBe(0)
    expect(s.latest).toBeNull()
    expect(s.calib).not.toBeNull()
  })

  test('log は LOG_MAX で頭から捨てる', () => {
    let s = initialState
    for (let i = 0; i < LOG_MAX + 50; i++) {
      s = reduce(s, { type: 'SAMPLE', sample: sample(i, 0, 0, 1) })
    }
    expect(s.log).toHaveLength(LOG_MAX)
    // 先頭は捨てられ、最古の t は 50
    expect(s.log[0].t).toBe(50)
  })
})
