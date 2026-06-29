import { describe, expect, test } from 'bun:test'
import {
  HOME_GOURMET_INDEX,
  HOME_STATION_SETTING_INDEX,
  HOME_TRAIN_INDEX,
  type HomeCardModel,
  homeCardConfigs,
  homeCardModel,
} from './homeCards'

const baseModel: HomeCardModel = {
  statusBar: 'HISHO v9.9.9        2026年6月10日（水） 10:00',
  stationLabel: '最寄り駅：大保駅',
  trainLines: [
    '電車情報',
    '  次発 16:11  天神方面',
    '       16:20  大牟田方面',
  ],
  gourmetLabel: 'グルメ情報',
  stationSettingLabel: '最寄り駅設定',
  hint: '↕選択 タップ決定',
  highlightedIndex: HOME_TRAIN_INDEX,
}

function byName(model: HomeCardModel, name: string) {
  return homeCardConfigs(model).find((c) => c.containerName === name)
}

describe('homeCardConfigs (issue #37 Phase 6.2)', () => {
  test('7 コンテナ・isEventCapture は 1 つだけ・ID は一意', () => {
    const configs = homeCardConfigs(baseModel)
    expect(configs).toHaveLength(7)
    expect(configs.filter((c) => c.isEventCapture === 1)).toHaveLength(1)
    const ids = configs.map((c) => c.containerID)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('電車/グルメは角丸枠、ステータスバー/最寄り駅/最寄り駅設定/ヒントは枠なし', () => {
    expect(byName(baseModel, 'card-train')?.borderRadius).toBeGreaterThan(0)
    expect(byName(baseModel, 'card-gourmet')?.borderRadius).toBeGreaterThan(0)
    expect(byName(baseModel, 'card-train')?.borderWidth).toBeGreaterThan(0)
    expect(byName(baseModel, 'status')?.borderWidth).toBe(0)
    expect(byName(baseModel, 'station')?.borderWidth).toBe(0)
    expect(byName(baseModel, 'station-setting')?.borderWidth).toBe(0)
    expect(byName(baseModel, 'hint')?.borderWidth).toBe(0)
  })

  test('選択カーソルは選択中の項目だけに付く（電車選択時）', () => {
    const m = { ...baseModel, highlightedIndex: HOME_TRAIN_INDEX }
    expect(byName(m, 'card-train')?.content).toContain('▶ 電車情報')
    expect(byName(m, 'station')?.content).not.toContain('▶')
    expect(byName(m, 'card-gourmet')?.content).not.toContain('▶')
  })

  test('選択を移すとカーソルが移動する（グルメ / 最寄り駅設定）', () => {
    const setting = {
      ...baseModel,
      highlightedIndex: HOME_STATION_SETTING_INDEX,
    }
    expect(byName(setting, 'station-setting')?.content).toContain(
      '▶ 最寄り駅設定',
    )
    expect(byName(setting, 'card-train')?.content).not.toContain('▶')
    // 最寄り駅は情報表示なので何を選んでもカーソルは付かない
    expect(byName(setting, 'station')?.content).not.toContain('▶')

    const gourmet = { ...baseModel, highlightedIndex: HOME_GOURMET_INDEX }
    expect(byName(gourmet, 'card-gourmet')?.content).toContain('▶ グルメ情報')
    expect(byName(gourmet, 'card-train')?.content).not.toContain('▶')
  })

  test('電車カードは次発行を保持する', () => {
    const train = byName(baseModel, 'card-train')
    expect(train?.content).toContain('次発 16:11')
    expect(train?.content).toContain('16:20')
  })

  test('全コンテナがディスプレイ（576×288）内に収まる', () => {
    for (const c of homeCardConfigs(baseModel)) {
      expect(c.xPosition + c.width).toBeLessThanOrEqual(576)
      expect(c.yPosition + c.height).toBeLessThanOrEqual(288)
    }
  })
})

describe('homeCardModel', () => {
  const now = new Date('2026-06-10T10:00:00+09:00')

  test('既定原点から最寄駅・電車情報・グルメ情報を組み立てる', () => {
    const m = homeCardModel(
      { lat: 33.39, lon: 130.46 },
      null,
      HOME_TRAIN_INDEX,
      now,
    )
    expect(m.statusBar).toContain('HISHO')
    expect(m.stationLabel).toContain('最寄り駅：')
    expect(m.trainLines[0]).toBe('電車情報')
    expect(m.gourmetLabel).toBe('グルメ情報')
    expect(m.stationSettingLabel).toBe('最寄り駅設定')
    expect(m.highlightedIndex).toBe(HOME_TRAIN_INDEX)
  })

  test('手動選択駅は "（固定）" を付ける', () => {
    const m = homeCardModel({ lat: 33.39, lon: 130.46 }, '大保', 0, now)
    expect(m.stationLabel).toContain('（固定）')
  })
})
