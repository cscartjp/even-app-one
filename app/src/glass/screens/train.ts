import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { ohoDirections } from '../../data/oho-timetable'
import { formatDeparture, getNextDepartures } from '../../data/timetable'
import type { AppActions, AppSnapshot } from '../shared'

const DISPLAY_COUNT = 5
const DIRECTION_COUNT = ohoDirections.length // 2: 天神方面 / 大牟田方面

export const trainScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(_snapshot, nav) {
    const dirIdx = nav.highlightedIndex % DIRECTION_COUNT
    const direction = ohoDirections[dirIdx]
    const now = new Date()
    const departures = getNextDepartures(direction, now, DISPLAY_COUNT)

    if (departures.length === 0) {
      return {
        lines: [
          ...glassHeader(`大保 → ${direction.label}`),
          line('本日の運行は終了しました'),
        ],
      }
    }

    return {
      lines: [
        ...glassHeader(`大保 → ${direction.label}`),
        ...departures.map((d) => line(formatDeparture(d))),
        line(''),
        line('↕方面切替', 'meta'),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
      return nav
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      // UP/DOWN で方面を切り替え (0 ↔ 1)
      const next =
        action.direction === 'up'
          ? (nav.highlightedIndex - 1 + DIRECTION_COUNT) % DIRECTION_COUNT
          : (nav.highlightedIndex + 1) % DIRECTION_COUNT
      return { ...nav, highlightedIndex: next }
    }
    return nav
  },
}
