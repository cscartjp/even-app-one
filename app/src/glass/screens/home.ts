import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import type { AppActions, AppSnapshot } from '../shared'

export const homeScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    return {
      lines: buildScrollableList({
        items: snapshot.menuItems,
        highlightedIndex: nav.highlightedIndex,
        maxVisible: 5,
        formatter: (item) => item.label,
      }),
    }
  },

  action(action, nav, snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      if (snapshot.menuItems.length === 0) return nav
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          snapshot.menuItems.length - 1,
        ),
      }
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      const item = snapshot.menuItems[nav.highlightedIndex]
      if (item) ctx.navigate(item.path)
      return nav
    }
    return nav
  },
}
