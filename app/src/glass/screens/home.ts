import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { line } from 'even-toolkit/types'
import { nearestStation } from '../../data/stations'
import { getNextDepartures } from '../../data/timetable'
import { type AppActions, type AppSnapshot, statusBarLine } from '../shared'

/** ホーム画面のメニュー項目インデックス */
const MENU_TRAIN = 0
const MENU_GOURMET = 1

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
        statusBarLine(now),
        // 行1: 最寄駅
        line(`最寄駅: ${station.name}駅`, 'meta'),
        // 行2: 空行
        line(''),
        // 行3: 電車情報（選択中なら inverted）
        line('電車情報', 'normal', isTrain),
        // 行4〜5: 次発（方面数ぶん）
        ...trainRows,
        // 空行
        line(''),
        // グルメ情報（選択中なら inverted）
        line('グルメ情報', 'normal', !isTrain),
        // 空行
        line(''),
        // ヒント
        line('↕選択 タップ決定', 'meta'),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      // 電車情報 (0) / グルメ情報 (1) を端でクランプして移動
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          MENU_GOURMET,
        ),
      }
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      if (nav.highlightedIndex === MENU_TRAIN) {
        ctx.navigate('/train')
      } else {
        ctx.navigate('/gourmet')
      }
      return nav
    }
    return nav
  },
}
