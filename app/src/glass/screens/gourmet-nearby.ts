import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { clampIndex, moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import {
  countNearby,
  formatDistance,
  getShopStatus,
  nearbyByGenre,
  statusMark,
} from '../../data/gourmet'
import { type Shop, shops } from '../../data/shops'
import { type AppActions, type AppSnapshot, statusBarLines } from '../shared'

const MAX_VISIBLE = 3

/** 選択中の店の詳細を下部にインライン表示（別画面を作らずチラ見） */
function detailLines(shop: Shop, now: Date) {
  const { label } = getShopStatus(shop, now)
  const place = shop.area ? `${shop.genre}・${shop.area}` : shop.genre
  const lines = [line(`${place}  ${label}`, 'meta')]
  if (shop.note) lines.push(line(shop.note, 'meta'))
  return lines
}

export const gourmetNearbyScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    const now = new Date()
    const items = nearbyByGenre(shops, snapshot.selectedGenre, snapshot.origin)
    const title = snapshot.selectedGenre ?? '近くの店'

    if (items.length === 0) {
      return {
        lines: [
          ...statusBarLines(now),
          ...glassHeader(title),
          line('該当する店がありません', 'meta'),
        ],
      }
    }

    const idx = clampIndex(nav.highlightedIndex, items.length)
    const selected = items[idx]

    return {
      lines: [
        ...statusBarLines(now),
        ...glassHeader(title),
        ...buildScrollableList({
          items,
          highlightedIndex: idx,
          maxVisible: MAX_VISIBLE,
          formatter: ({ shop, meters }) =>
            `${statusMark(shop, now)} ${shop.name}  ${formatDistance(meters)}`,
        }),
        ...detailLines(selected.shop, now),
      ],
    }
  },

  action(action, nav, snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/gourmet')
      return nav
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      // 件数だけ必要なので距離計算・ソートはしない（NEAREST_LIMIT と同期）
      const count = countNearby(shops, snapshot.selectedGenre)
      if (count === 0) return nav
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          count - 1,
        ),
      }
    }
    return nav
  },
}
