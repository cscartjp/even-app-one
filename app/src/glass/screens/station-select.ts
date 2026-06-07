import { buildScrollableList } from 'even-toolkit/glass-display-builders'
import { moveHighlight } from 'even-toolkit/glass-nav'
import type { GlassScreen } from 'even-toolkit/glass-screen-router'
import { glassHeader, line } from 'even-toolkit/types'
import { stations } from '../../data/stations'
import { type AppActions, type AppSnapshot, statusBarLines } from '../shared'

/**
 * 駅選択肢: 先頭「自動（現在地から判定）」+ stations 4 駅
 * value が null は「自動モード（GPS > 既定）」を表す
 */
const ITEMS: { label: string; value: string | null }[] = [
  { label: '自動（現在地から判定）', value: null },
  ...stations.map((s) => ({ label: s.name, value: s.name })),
]

/**
 * 駅選択画面（ルート /station）
 *
 * グラス 10 行制約（statusBarLines 2 行 + glassHeader 2 行 + 合計 4 行使用）:
 *   statusBarLines: 2行
 *   glassHeader:    2行
 *   リスト 5 項目:  5行
 *   ヒント:         1行
 *   合計:          10行
 */
export const stationSelectScreen: GlassScreen<AppSnapshot, AppActions> = {
  display(snapshot, nav) {
    return {
      lines: [
        ...statusBarLines(),
        // 画面タイトル
        ...glassHeader('駅を選択'),
        // 選択肢リスト（5 項目すべて表示。現在の設定値に ✓ マーク）
        ...buildScrollableList({
          items: ITEMS,
          highlightedIndex: nav.highlightedIndex,
          maxVisible: 5,
          formatter: ({ label, value }) => {
            // selectedStation が null なら「自動」に ✓、駅名一致ならその駅に ✓
            const isSelected =
              value === null
                ? snapshot.selectedStation === null
                : snapshot.selectedStation === value
            return isSelected ? `✓ ${label}` : `  ${label}`
          },
        }),
        // ヒント行（ナビゲーション操作を案内）
        line('↕選択 タップ決定  戻る=ホーム', 'meta'),
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
          ITEMS.length - 1,
        ),
      }
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      const item = ITEMS[nav.highlightedIndex]
      if (item) {
        // 選択駅を更新（null は自動モードに戻す）して storage に永続化
        ctx.setStation(item.value)
        ctx.navigate('/')
      }
      return nav
    }
    return nav
  },
}
