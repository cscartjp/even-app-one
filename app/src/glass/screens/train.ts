import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { nearestStation } from '../../data/stations'
import { formatDeparture, getNextDepartures } from '../../data/timetable'
import { type AppActions, type AppSnapshot, statusBarLine } from '../shared'

const DISPLAY_COUNT = 5

export const trainScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    // origin（GPS 現在地または既定値）から最寄り駅を選び、その時刻表を出す
    const station = nearestStation(snapshot.origin)
    const dirIdx = nav.highlightedIndex % station.directions.length
    const direction = station.directions[dirIdx]
    const now = new Date()
    const departures = getNextDepartures(direction, now, DISPLAY_COUNT)

    if (departures.length === 0) {
      return {
        lines: [
          statusBarLine(now),
          ...glassHeader(`${station.name} → ${direction.label}`),
          line('本日の運行は終了しました'),
        ],
      }
    }

    return {
      lines: [
        statusBarLine(now),
        ...glassHeader(`${station.name} → ${direction.label}`),
        ...departures.map((d) => line(formatDeparture(d))),
        line(''),
        // 方面が1つしかない駅では切替ヒントを出さない
        ...(station.directions.length > 1 ? [line('↕方面切替', 'meta')] : []),
      ],
    }
  },

  action(action, nav, snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
      return nav
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      // UP/DOWN で方面を切り替え（方面数は駅ごとに 1〜2）
      const count = nearestStation(snapshot.origin).directions.length
      if (count <= 1) return nav
      const next =
        action.direction === 'up'
          ? (nav.highlightedIndex - 1 + count) % count
          : (nav.highlightedIndex + 1) % count
      return { ...nav, highlightedIndex: next }
    }
    return nav
  },
}
