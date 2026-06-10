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

/**
 * アプリ版を返す。正本は app.json の version。
 * build は Vite define が `__APP_VERSION__` をリテラル置換する。
 * Vite を介さない実行（bun test / preview ツール）は globalThis 経由で供給され、
 * 未供給時は '0.0.0-dev' にフォールバックする（未定義参照でクラッシュさせない）。
 */
function appVersion(): string {
  return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev'
}

// separator（'─'×27）と同じ右端 540px を基準に空白数を事前計算する
// getTextWidth は LVGL レンダリングと一致するピクセル値（@evenrealities/pretext）
const SPACE_PX = getTextWidth(' ')
const BAR_WIDTH_PX = getTextWidth('─'.repeat(27))

/**
 * left と right を separator 右端（540px）に揃えて 1 行にする。
 * ステータスバーと split ヘッダーの右寄せ（時計 / N/M カウント）で共用。
 * 右側（時計 / カウント）を優先し、左が長くて収まらない時は left を省略して
 * 常に 540px 以内に収める（右側が押し出されて消えるのを防ぐ）。
 */
export function justifyToBarWidth(left: string, right: string): string {
  const rightPx = getTextWidth(right)
  const leftFit = truncateByPixel(left, BAR_WIDTH_PX - rightPx - SPACE_PX)
  const spaces = Math.max(
    1,
    Math.floor((BAR_WIDTH_PX - getTextWidth(leftFit) - rightPx) / SPACE_PX),
  )
  return `${leftFit}${' '.repeat(spaces)}${right}`
}

/**
 * ステータスバー共通実装。全画面の出力先頭 2 行（バー＋罫線）に挿入する。
 * 罫線が 1 行消費するため、各画面は実機の 10 行制約に収まるよう空行を調整する。
 * 内容: 「HISHO v<version>」＋右寄せ「YYYY年M月D日（曜） HH:MM」（separator 右端に揃える）
 */
export function statusBarLines(now: Date = new Date()): DisplayLine[] {
  return [
    line(justifyToBarWidth(`HISHO v${appVersion()}`, formatClock(now))),
    line('', 'separator'),
  ]
}

const ELLIPSIS = '…'
const ELLIPSIS_PX = getTextWidth(ELLIPSIS)

/**
 * テキストを最大ピクセル幅に収まるよう省略する。
 * 超過時は「…」を付け、「…」込みで maxPx を超えない側に丸める。
 * maxPx が「…」幅未満なら「…」すら入らないため空文字を返す（maxPx を超えない保証）。
 * 幅は @evenrealities/pretext の getTextWidth（LVGL 実機レンダリングと一致）。
 */
export function truncateByPixel(text: string, maxPx: number): string {
  if (getTextWidth(text) <= maxPx) return text
  if (maxPx < ELLIPSIS_PX) return ''
  const limit = maxPx - ELLIPSIS_PX
  let width = 0
  let out = ''
  for (const ch of text) {
    const w = getTextWidth(ch)
    if (width + w > limit) break
    out += ch
    width += w
  }
  return out + ELLIPSIS
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
  /** 手動選択した駅名。null は「自動（GPS > 既定）」モード */
  selectedStation: string | null
}

export interface AppActions {
  navigate: (path: string) => void
  setGenre: (genre: string | null) => void
  /** 手動選択駅を更新し storage に永続化する */
  setStation: (name: string | null) => void
}
