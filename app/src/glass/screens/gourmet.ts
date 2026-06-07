import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { listGenres } from '../../data/gourmet'
import { shops } from '../../data/shops'
import type { AppActions, AppSnapshot } from '../shared'

// ジャンルはデータから自動抽出（店を足せば選択肢も増える）
const genres = listGenres(shops)

export const gourmetScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const header = glassHeader(`グルメ (${snapshot.originLabel})`)
    if (genres.length === 0) {
      return { lines: [...header, line('店が登録されていません', 'meta')] }
    }
    return {
      lines: [
        // 原点が現在地か既定駅かをヘッダーで明示
        ...header,
        ...buildScrollableList({
          items: genres,
          highlightedIndex: nav.highlightedIndex,
          maxVisible: 6,
          formatter: (g) => g,
        }),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
      return nav
    }
    // ジャンルが無いときは移動・選択を無視（homeScreen と同じガード）
    if (genres.length === 0) return nav
    if (action.type === 'HIGHLIGHT_MOVE') {
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          genres.length - 1,
        ),
      }
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      const genre = genres[nav.highlightedIndex]
      if (genre) {
        ctx.setGenre(genre)
        ctx.navigate('/gourmet/nearby')
      }
      return nav
    }
    return nav
  },
}
