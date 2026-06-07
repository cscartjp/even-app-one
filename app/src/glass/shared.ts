import { getTextWidth } from '@evenrealities/pretext'
import type { DisplayLine } from 'even-toolkit/types'
import { line } from 'even-toolkit/types'
import type { GeoPoint } from '../data/shops'

export interface MenuItem {
  label: string
  path: string
}

/** 曜日ラベル */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

/**
 * 現在日時を「YYYY年M月D日（曜） HH:MM」形式で返す
 * 例: 「2026年6月7日（日） 16:03」
 */
function formatClock(now: Date): string {
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const d = now.getDate()
  const w = WEEKDAYS[now.getDay()]
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${d}日（${w}） ${hh}:${mm}`
}

// separator（'─'×27）と同じ右端 540px を基準に空白数を事前計算する
// getTextWidth は LVGL レンダリングと一致するピクセル値（@evenrealities/pretext）
const SPACE_PX = getTextWidth(' ')
const BAR_WIDTH_PX = getTextWidth('─'.repeat(27))

/**
 * ステータスバー共通実装。全画面の出力先頭 2 行（バー＋罫線）に挿入する。
 * 罫線が 1 行消費するため、各画面は実機の 10 行制約に収まるよう空行を調整する。
 * 内容: 「HISHO」＋右寄せ「YYYY年M月D日（曜） HH:MM」（separator 右端に揃える）
 */
export function statusBarLines(now: Date = new Date()): DisplayLine[] {
  const left = 'HISHO'
  const right = formatClock(now)
  const spaces = Math.max(
    1,
    Math.floor(
      (BAR_WIDTH_PX - getTextWidth(left) - getTextWidth(right)) / SPACE_PX,
    ),
  )
  return [line(`${left}${' '.repeat(spaces)}${right}`), line('', 'separator')]
}

export interface AppSnapshot {
  menuItems: MenuItem[]
  flashPhase: boolean
  /** 距離計算の原点（GPS で取れたら現在地、ダメなら既定の駅） */
  origin: GeoPoint
  /** 原点の表示名（「現在地」または駅名） */
  originLabel: string
  /** グルメで選択中のジャンル（未選択は null） */
  selectedGenre: string | null
}

export interface AppActions {
  navigate: (path: string) => void
  setGenre: (genre: string | null) => void
}
