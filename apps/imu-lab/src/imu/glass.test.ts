import { describe, expect, test } from 'bun:test'
import { glassLines } from './glass'
import { initialLabState, type LabState } from './state'

describe('glassLines', () => {
  test('未接続・未受信でもクラッシュせず 6 行', () => {
    const lines = glassLines(initialLabState, '0.0.1')
    expect(lines).toHaveLength(6)
    expect(lines[0]).toBe('IMU Lab v0.0.1')
    expect(lines[1]).toContain('停止中')
    expect(lines[1]).toContain('未接続')
    expect(lines[2]).toContain('--')
  })

  test('計測中は状態に pace が出る', () => {
    const s: LabState = {
      ...initialLabState,
      connected: true,
      measuring: true,
      pace: 500,
    }
    const lines = glassLines(s, '0.0.1')
    expect(lines[1]).toBe('● 計測中 P500')
  })

  test('生値・norm・サンプル数を表示', () => {
    const s: LabState = {
      ...initialLabState,
      connected: true,
      latest: { t: 0, x: 0, y: 0, z: 1 },
      sampleCount: 42,
      rateHz: 9.8,
      battery: 87,
    }
    const lines = glassLines(s, '1.2.3')
    expect(lines[2]).toContain('x  0.00')
    expect(lines[3]).toContain('|v| 1.00')
    expect(lines[3]).toContain('要キャリブ')
    expect(lines[4]).toContain('Hz 9.8')
    expect(lines[4]).toContain('bat 87%')
    expect(lines[4]).toContain('n=42')
  })

  test('キャリブ済みなら θ が出て要キャリブ表記が消える', () => {
    const s: LabState = {
      ...initialLabState,
      connected: true,
      latest: { t: 0, x: 0, y: 1, z: 1 },
      calib: { x: 0, y: 0, z: 1 },
    }
    const lines = glassLines(s, '0.0.1')
    expect(lines[3]).toContain('θ 45°')
    expect(lines[3]).not.toContain('要キャリブ')
  })
})
