import { getTextWidth } from '@evenrealities/pretext'
import {
  buildScrollableList,
  slidingWindowStart,
} from 'even-toolkit/glass-display-builders'
import { clampIndex, moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import type { GlassNavState, SplitData } from 'even-toolkit/types'
import { GLASSES_TEXT_PREFIX, glassHeader, line } from 'even-toolkit/types'
import {
  countNearby,
  formatDistance,
  getShopStatus,
  nearbyByGenre,
  statusMark,
} from '../../data/gourmet'
import { type Shop, shops } from '../../data/shops'
import {
  type AppActions,
  type AppSnapshot,
  justifyToBarWidth,
  statusBarLines,
  truncateByPixel,
} from '../shared'

const MAX_VISIBLE = 3

/** 選択中の店の詳細を下部にインライン表示（別画面を作らずチラ見） */
function detailLines(shop: Shop, now: Date) {
  const { label } = getShopStatus(shop, now)
  const place = shop.area ? `${shop.genre}・${shop.area}` : shop.genre
  const lines = [line(`${place}  ${label}`, 'meta')]
  if (shop.note) lines.push(line(shop.note, 'meta'))
  return lines
}

// ─── split 表示（左=店舗リスト / 右=選択店舗の詳細） ───
// 正本: app/preview/design-mock.html の gourmetNearby ノード（2026-06-08 確定）

/** ヘッダー行数（ステータスバー + タイトル + 罫線）× 実機 line height 27px */
const SPLIT_HEADER_PX = 3 * 27
/** 左リストの最大表示行数。下部領域 (288-81)px ÷ 27px ≈ 7 行 */
const SPLIT_MAX_VISIBLE = 7
/**
 * 3 ペイン構成のピクセル幅 [左リスト, 縦線, 右詳細]（合計 576px）。
 * モックの .nb-list border-right を中央の細いペインで再現する。
 * split のコンテナ枠線は even-toolkit が強制的に消すため、独立ペインに
 * テキストの縦線を描く方式にする（スペース埋めだとフォント幅誤差で折り返すため）。
 * 中央 36px = paddingLength 6×2(=12) + '│' 20px + 余裕。raw split は各 pane に
 * paddingLength:6 を付けるため、これ未満だと実機で '│' がクリップされる。
 * 左 300px は最長行(282px)+padding(12) を満たす。右は残りの 240px。
 */
const SPLIT_PANE_WIDTHS = [300, 36, 240]
/** 左リストで店名に割ける最大幅。左ペイン 300px 内に cursor+マーク+距離込みで収める */
const NAME_MAX_PX = getTextWidth('あ') * 9
/** 縦区切り線ペインの中身（下部領域の行数ぶん '│' を縦に並べる） */
const VLINE_COLUMN = Array.from({ length: SPLIT_MAX_VISIBLE }, () => '│').join(
  '\n',
)

/** プレビュー（render-screens.ts）と共有する画面ビューモデル。モックの JSON 構造と同形 */
export interface NearbyView {
  title: string
  count: string
  list: { mark: string; name: string; dist: string }[]
  sel: number
  detail: { name: string; status: string; tel?: string; notes: string[] }
}

/** 0件時は null（呼び出し側で空表示にフォールバック） */
export function gourmetNearbyView(
  snapshot: AppSnapshot,
  nav: GlassNavState,
): NearbyView | null {
  const now = new Date()
  const items = nearbyByGenre(shops, snapshot.selectedGenre, snapshot.origin)
  const title = `${snapshot.selectedGenre ?? '近くの店'} (${snapshot.originLabel})`
  if (items.length === 0) return null

  const idx = clampIndex(nav.highlightedIndex, items.length)
  const selected = items[idx].shop
  const notes: string[] = []
  if (selected.note) notes.push(selected.note)

  return {
    title,
    count: `${idx + 1}/${items.length}`,
    list: items.map(({ shop, meters }) => ({
      mark: statusMark(shop, now),
      name: shop.name,
      dist: formatDistance(meters),
    })),
    sel: idx,
    detail: {
      name: selected.name,
      status: `${statusMark(selected, now)} ${getShopStatus(selected, now).label}`,
      tel: selected.tel,
      notes,
    },
  }
}

/**
 * split モード用ビルダー。
 * header: ステータスバー + タイトル行（右寄せ N/M）/ 左: スクロールリスト / 右: 選択店舗詳細。
 * split ペインは renderTextPageLines を通らない生文字列のため、
 * 行頭プレフィックス（'  ' / 選択行 '▶ '）はここで付ける。
 */
export function gourmetNearbySplit(
  snapshot: AppSnapshot,
  nav: GlassNavState,
): SplitData {
  const now = new Date()
  const view = gourmetNearbyView(snapshot, nav)
  const bar = statusBarLines(now)[0].text
  const layout = {
    headerHeight: SPLIT_HEADER_PX,
    paneWidths: SPLIT_PANE_WIDTHS,
  }
  const PREFIX = GLASSES_TEXT_PREFIX

  // ヘッダー 3 行目の罫線（モックの .nb-head border-bottom を実機で再現）。
  // bar と同じ右端（separator 幅）まで引き、中央の縦線ペインと T 字に交差させる
  const rule = `${PREFIX}${'─'.repeat(27)}`

  if (view === null) {
    const title = `${snapshot.selectedGenre ?? '近くの店'} (${snapshot.originLabel})`
    return {
      header: `${PREFIX}${bar}\n${PREFIX}${title}\n${rule}`,
      panes: [`${PREFIX}該当する店がありません`, VLINE_COLUMN, ''],
      layout,
    }
  }

  const header = `${PREFIX}${bar}\n${PREFIX}${justifyToBarWidth(view.title, view.count)}\n${rule}`

  const start = slidingWindowStart(
    view.sel,
    view.list.length,
    SPLIT_MAX_VISIBLE,
  )
  const left = view.list
    .slice(start, start + SPLIT_MAX_VISIBLE)
    .map((item, i) => {
      const cursor = start + i === view.sel ? '▶ ' : PREFIX
      return `${cursor}${item.mark} ${truncateByPixel(item.name, NAME_MAX_PX)} ${item.dist}`
    })
    .join('\n')

  // 右ペイン: 正式名称はコンテナ幅で自動折返し（実質最大2行）。TEL・補足はある時のみ
  const rightLines = [view.detail.name, view.detail.status]
  if (view.detail.tel) rightLines.push(`TEL ${view.detail.tel}`)
  rightLines.push(...view.detail.notes)

  return { header, panes: [left, VLINE_COLUMN, rightLines.join('\n')], layout }
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
