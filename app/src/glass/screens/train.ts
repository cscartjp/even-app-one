import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppActions, AppSnapshot } from '../shared'

// 仮データ。MVP で同梱の時刻表 JSON に置き換える(大保は普通のみ停車)
const mockDepartures = [
  '09:12 普通 福岡(天神)行',
  '09:27 普通 福岡(天神)行',
  '09:42 普通 福岡(天神)行',
]

export const trainScreen: GlassScreen<AppSnapshot, AppActions> = {
  display() {
    return {
      lines: [
        ...glassHeader('大保 → 福岡(天神)方面'),
        ...mockDepartures.map((d) => line(d)),
        line(''),
        line('※モックデータ', 'meta'),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
    }
    return nav
  },
}
