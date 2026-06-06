/**
 * 「今開いてる店」ロジック。
 * train の getNextDepartures(now) と対になる、現在時刻ベースの状態計算。
 */
import type { Shop, TimeRange } from './shops'

/** 閉店間際とみなすしきい値（分） */
const CLOSING_SOON_MIN = 30

export type ShopState = 'open' | 'closing-soon' | 'closed'

export interface ShopStatus {
  readonly state: ShopState
  /** 表示用ラベル（例: 「営業中 〜22:00」「あと20分で閉店」「17:30開店」「定休」） */
  readonly label: string
  /** 並び替え用キー（小さいほど上位）。営業中→間もなく開く→閉店済み の順 */
  readonly sortKey: number
}

// 土日のみ判定。祝日は未対応（train と共通の TODO）
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** その日の営業帯を返す */
export function todayRanges(shop: Shop, now: Date): readonly TimeRange[] {
  return isWeekend(now) ? shop.weekend : shop.weekday
}

/** 現在時刻に対する店の状態を計算 */
export function getShopStatus(shop: Shop, now: Date): ShopStatus {
  const ranges = todayRanges(shop, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (ranges.length === 0) {
    return { state: 'closed', label: '定休', sortKey: 300 }
  }

  // 営業中の帯を探す
  for (const range of ranges) {
    if (nowMin >= range.open && nowMin < range.close) {
      const left = range.close - nowMin
      if (left <= CLOSING_SOON_MIN) {
        return {
          state: 'closing-soon',
          label: `あと${left}分で閉店`,
          sortKey: 100 - left, // 閉店が近いほど上に
        }
      }
      return {
        state: 'open',
        label: `営業中 〜${hhmm(range.close)}`,
        sortKey: 0,
      }
    }
  }

  // これから開く帯を探す
  let nextOpen = Number.POSITIVE_INFINITY
  for (const range of ranges) {
    if (range.open > nowMin && range.open < nextOpen) nextOpen = range.open
  }
  if (nextOpen !== Number.POSITIVE_INFINITY) {
    const wait = nextOpen - nowMin
    return {
      state: 'closed',
      label: `${hhmm(nextOpen)}開店`,
      sortKey: 200 + wait, // 開店が早い順
    }
  }

  return { state: 'closed', label: '本日終了', sortKey: 280 }
}

/** 開いてる店を上に並べ替えて返す（元配列は不変） */
export function sortShops(shops: readonly Shop[], now: Date): Shop[] {
  return [...shops].sort(
    (a, b) => getShopStatus(a, now).sortKey - getShopStatus(b, now).sortKey,
  )
}

/** リスト1行用：状態マーク＋店名 */
export function formatShopLine(shop: Shop, now: Date): string {
  const { state } = getShopStatus(shop, now)
  const mark = state === 'open' ? '●' : state === 'closing-soon' ? '◐' : '○'
  return `${mark} ${shop.name}`
}
