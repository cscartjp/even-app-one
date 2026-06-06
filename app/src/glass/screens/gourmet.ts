import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { clampIndex, moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { formatShopLine, getShopStatus, sortShops } from '../../data/gourmet'
import type { Shop } from '../../data/shops'
import { shops } from '../../data/shops'
import type { AppActions, AppSnapshot } from '../shared'

const MAX_VISIBLE = 4

/** 選択中の店の詳細を下部に表示（タップ遷移なしでチラ見） */
function detailLines(shop: Shop, now: Date) {
  const { label } = getShopStatus(shop, now)
  const place = shop.area ? `${shop.genre}・${shop.area}` : shop.genre
  const lines = [line(`${place}  ${label}`, 'meta')]
  if (shop.note) lines.push(line(shop.note, 'meta'))
  return lines
}

export const gourmetScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(_snapshot, nav) {
    const now = new Date()
    const sorted = sortShops(shops, now)

    if (sorted.length === 0) {
      return {
        lines: [
          ...glassHeader('グルメ情報'),
          line('登録された店がありません', 'meta'),
        ],
      }
    }

    const idx = clampIndex(nav.highlightedIndex, sorted.length)
    const selected = sorted[idx]

    return {
      lines: [
        ...glassHeader('グルメ情報'),
        ...buildScrollableList({
          items: sorted,
          highlightedIndex: idx,
          maxVisible: MAX_VISIBLE,
          formatter: (shop) => formatShopLine(shop, now),
        }),
        ...detailLines(selected, now),
      ],
    }
  },

  action(action, nav, _snapshot, ctx) {
    if (action.type === 'GO_BACK') {
      ctx.navigate('/')
      return nav
    }
    if (action.type === 'HIGHLIGHT_MOVE') {
      return {
        ...nav,
        highlightedIndex: moveHighlight(
          nav.highlightedIndex,
          action.direction,
          shops.length - 1,
        ),
      }
    }
    return nav
  },
}
