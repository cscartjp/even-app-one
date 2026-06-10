import { describe, expect, test } from 'bun:test'
import { type HomeCardData, homeCardConfigs } from './homeCardSpike'

const baseData: HomeCardData = {
  stationLabel: '最寄駅: 大保駅',
  trainLines: [
    '電車情報',
    '  次発 16:11  天神方面',
    '       16:20  大牟田方面',
  ],
  gourmetLabel: 'グルメ情報',
  hint: '↕選択 タップ決定',
  selectedIndex: 0,
}

describe('homeCardConfigs (issue #37 Phase 6.1 spike)', () => {
  test('overlay 含む 5 コンテナを返し、isEventCapture は 1 つだけ・ID は一意', () => {
    const configs = homeCardConfigs(baseData)
    expect(configs).toHaveLength(5)
    expect(configs.filter((c) => c.isEventCapture === 1)).toHaveLength(1)
    const ids = configs.map((c) => c.containerID)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('カードは角丸枠を持ち、電車選択時は電車カードの枠が明るい', () => {
    const configs = homeCardConfigs({ ...baseData, selectedIndex: 0 })
    const train = configs.find((c) => c.containerName === 'card-train')
    const gourmet = configs.find((c) => c.containerName === 'card-gourmet')
    expect(train?.borderWidth).toBeGreaterThan(0)
    expect(train?.borderRadius).toBeGreaterThan(0)
    expect(gourmet?.borderRadius).toBeGreaterThan(0)
    // 選択中（電車）の枠 > 非選択（グルメ）の枠
    expect(train?.borderColor ?? 0).toBeGreaterThan(gourmet?.borderColor ?? 0)
  })

  test('選択を切り替えると明るい枠がグルメカードへ移る', () => {
    const configs = homeCardConfigs({ ...baseData, selectedIndex: 1 })
    const train = configs.find((c) => c.containerName === 'card-train')
    const gourmet = configs.find((c) => c.containerName === 'card-gourmet')
    expect(gourmet?.borderColor ?? 0).toBeGreaterThan(train?.borderColor ?? 0)
  })

  test('電車カードの中身に次発行が入る', () => {
    const configs = homeCardConfigs(baseData)
    const train = configs.find((c) => c.containerName === 'card-train')
    expect(train?.content).toContain('電車情報')
    expect(train?.content).toContain('次発 16:11')
  })

  test('全コンテナがディスプレイ（576×288）内に収まる', () => {
    for (const c of homeCardConfigs(baseData)) {
      expect(c.xPosition + c.width).toBeLessThanOrEqual(576)
      expect(c.yPosition + c.height).toBeLessThanOrEqual(288)
    }
  })
})
