import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import { nearestStation } from '../../data/stations'
import { getNextDepartures } from '../../data/timetable'
import { type AppActions, type AppSnapshot, statusBarLines } from '../shared'

/**
 * ホーム画面の選択可能メニュー項目インデックス。
 * 最寄り駅は GPS で自動取得されるため情報表示（非選択）にし、
 * 駅の手動変更は使用頻度が低いので「最寄り駅設定」として最下段に置く。
 */
const MENU_TRAIN = 0
const MENU_GOURMET = 1
const MENU_STATION_SETTING = 2

/**
 * 次発時刻を "HH:MM" 形式で返す。終電後は翌日始発が「翌HH:MM」で返る
 * （getNextDepartures が翌日分まで探すため）。時刻表が完全に空の場合のみ "--:--"。
 */
function nextDepartureTime(
  direction: Parameters<typeof getNextDepartures>[0],
  now: Date,
): string {
  const deps = getNextDepartures(direction, now, 1)
  if (deps.length === 0) return '--:--'
  return deps[0].time
}

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const now = new Date()
    const station = nearestStation(snapshot.origin)
    const isTrain = nav.highlightedIndex === MENU_TRAIN
    const isGourmet = nav.highlightedIndex === MENU_GOURMET
    const isStationSetting = nav.highlightedIndex === MENU_STATION_SETTING

    // 最寄り駅行のラベル（GPS 自動取得・手動固定中はその旨を表示）
    const stationLabel =
      snapshot.selectedStation !== null
        ? `最寄り駅：${station.name}駅（固定）`
        : `最寄り駅：${station.name}駅`

    // 次発時刻を各方面ぶん計算
    const firstDir = station.directions[0]
    const firstTime = nextDepartureTime(firstDir, now)

    // 電車情報の行（1方面以上を持つ駅は必ず firstDir がある）
    const trainRows = [
      line(`  次発 ${firstTime}  ${firstDir.label}`, 'meta'),
      ...station.directions.slice(1).map((dir) => {
        const t = nextDepartureTime(dir, now)
        return line(`       ${t}  ${dir.label}`, 'meta')
      }),
    ]

    return {
      lines: [
        ...statusBarLines(now),
        // 最寄り駅（GPS 自動取得・情報表示で非選択）
        line(stationLabel, 'normal'),
        // 電車情報（選択中なら inverted）
        line('電車情報', 'normal', isTrain),
        // 行4〜5: 次発（方面数ぶん）
        ...trainRows,
        // 空行
        line(''),
        // グルメ情報（選択中なら inverted）
        line('グルメ情報', 'normal', isGourmet),
        // 空行
        line(''),
        // 最寄り駅設定（選択中なら inverted・手動で駅を変更する画面へ）
        line('最寄り駅設定', 'normal', isStationSetting),
        // ヒント
        line('↕選択 タップ決定', 'meta'),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      // 電車情報(0) / グルメ情報(1) / 最寄り駅設定(2) を端でクランプして移動
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          MENU_STATION_SETTING,
        ),
      }
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (nav.highlightedIndex === MENU_TRAIN) {
        ctx.navigate('/train')
      } else if (nav.highlightedIndex === MENU_GOURMET) {
        ctx.navigate('/gourmet')
      } else {
        ctx.navigate('/station')
      }
      return nav
    }
    return nav
  },
}
