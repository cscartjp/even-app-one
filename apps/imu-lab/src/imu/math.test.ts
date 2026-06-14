import { describe, expect, test } from 'bun:test'
import {
  angleBetweenDeg,
  CSV_HEADER,
  formatCsv,
  type ImuSample,
  movingAverageVec,
  norm,
  normalize,
  rateHz,
  roundDeg,
  toCsvRow,
} from './math'

describe('norm', () => {
  test('3-4-0 の大きさは 5', () => {
    expect(norm({ x: 3, y: 4, z: 0 })).toBe(5)
  })
  test('ゼロベクトルは 0', () => {
    expect(norm({ x: 0, y: 0, z: 0 })).toBe(0)
  })
})

describe('normalize', () => {
  test('単位ベクトル化で大きさ 1', () => {
    const n = normalize({ x: 0, y: 0, z: 9.8 })
    expect(n).not.toBeNull()
    expect(norm(n as { x: number; y: number; z: number })).toBeCloseTo(1, 6)
  })
  test('ゼロベクトルは null', () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toBeNull()
  })
})

describe('angleBetweenDeg', () => {
  test('同方向は 0 度', () => {
    expect(
      angleBetweenDeg({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: 5 }),
    ).toBeCloseTo(0, 5)
  })
  test('直交は 90 度', () => {
    expect(
      angleBetweenDeg({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
    ).toBeCloseTo(90, 5)
  })
  test('逆方向は 180 度', () => {
    expect(
      angleBetweenDeg({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }),
    ).toBeCloseTo(180, 5)
  })
  test('45 度', () => {
    expect(
      angleBetweenDeg({ x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 1 }),
    ).toBeCloseTo(45, 5)
  })
  test('ゼロベクトルが絡むと null', () => {
    expect(
      angleBetweenDeg({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
    ).toBeNull()
  })
})

describe('movingAverageVec', () => {
  test('空配列はゼロベクトル', () => {
    expect(movingAverageVec([])).toEqual({ x: 0, y: 0, z: 0 })
  })
  test('平均を取る', () => {
    expect(
      movingAverageVec([
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 4, z: 6 },
      ]),
    ).toEqual({ x: 1, y: 2, z: 3 })
  })
})

describe('rateHz', () => {
  test('サンプル不足は 0', () => {
    expect(rateHz([])).toBe(0)
    expect(rateHz([100])).toBe(0)
  })
  test('100ms 間隔は約 10Hz', () => {
    expect(rateHz([0, 100, 200, 300])).toBeCloseTo(10, 5)
  })
  test('同時刻ばかりで span 0 は 0', () => {
    expect(rateHz([5, 5, 5])).toBe(0)
  })
})

describe('roundDeg', () => {
  test('四捨五入', () => {
    expect(roundDeg(12.4)).toBe(12)
    expect(roundDeg(12.6)).toBe(13)
    expect(roundDeg(-0.4)).toBe(0)
  })
})

describe('CSV 整形', () => {
  const s: ImuSample = { t: 123.7, x: 1, y: -2, z: 3, norm: 0 } as ImuSample
  test('toCsvRow は時刻丸め + 小数4桁 + norm 付与', () => {
    // norm(1,-2,3) = sqrt(14) ≈ 3.7417
    expect(toCsvRow(s)).toBe('124,1.0000,-2.0000,3.0000,3.7417')
  })
  test('formatCsv はヘッダ付き', () => {
    const csv = formatCsv([s])
    expect(csv.split('\n')[0]).toBe(CSV_HEADER)
    expect(csv.split('\n').length).toBe(2)
  })
})
