import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import type { AppActions, AppSnapshot } from '../shared'

export const gourmetScreen: GlassScreen<AppSnapshot, AppActions> = {
  display() {
    return {
      lines: [...glassHeader('グルメ情報'), line('準備中です', 'meta')],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
    }
    return nav
  },
}
