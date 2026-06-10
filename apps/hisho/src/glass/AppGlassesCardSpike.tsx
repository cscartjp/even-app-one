import { useEffect } from 'react'
import { defaultOrigin } from '../data/shops'
import { nearestStation } from '../data/stations'
import { getNextDepartures } from '../data/timetable'
import { type HomeCardData, renderHomeCardSpike } from './homeCardSpike'

/** 次発時刻を "HH:MM" で返す（home.ts と同じ規則・空なら "--:--"） */
function nextTime(
  dir: Parameters<typeof getNextDepartures>[0],
  now: Date,
): string {
  const deps = getNextDepartures(dir, now, 1)
  return deps.length === 0 ? '--:--' : deps[0].time
}

/**
 * 🧪 SPIKE (issue #37 Phase 6.1): ホームのカード化の見た目を実機で確認するための
 * throwaway コンポーネント。本番 AppGlasses の代わりに一時マウントし、raw SDK で
 * ネイティブ角丸枠カードを 1 度だけ描画する（静的・イベント無し・選択は明暗の枠色で表現）。
 * Go なら本実装（6.2）で AppGlasses に統合し、本コンポーネントと差し替えを破棄する。
 */
export function AppGlassesCardSpike() {
  useEffect(() => {
    const now = new Date()
    const station = nearestStation(defaultOrigin)
    const firstDir = station.directions[0]
    const trainLines = [
      '電車情報',
      `  次発 ${nextTime(firstDir, now)}  ${firstDir.label}`,
    ]
    const secondDir = station.directions[1]
    if (secondDir) {
      trainLines.push(`       ${nextTime(secondDir, now)}  ${secondDir.label}`)
    }
    const data: HomeCardData = {
      stationLabel: `最寄駅: ${station.name}駅`,
      trainLines,
      gourmetLabel: 'グルメ情報',
      hint: '↕選択 タップ決定',
      selectedIndex: 0,
    }
    // SDK ブリッジ不在（Web プレビュー）では reject されるので握りつぶす
    void renderHomeCardSpike(data).catch(() => {})
  }, [])
  return null
}
