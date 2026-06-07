/**
 * グルメ：ジャンル絞り込み・距離計算・「今開いてる店」状態。
 * 距離の原点(GeoPoint)は GPS / 既定駅どちらでも同じロジックで動く。
 */
import type { GeoPoint, Shop, TimeRange } from './shops'

/** 閉店間際とみなすしきい値（分） */
const CLOSING_SOON_MIN = 30

export type ShopState = 'open' | 'closing-soon' | 'closed'

export interface ShopStatus {
  readonly state: ShopState
  /** 表示用ラベル（例:「営業中 〜22:00」「あと20分で閉店」「17:30開店」「定休」） */
  readonly label: string
}

/** 土日のみ判定。祝日は未対応（train と共通の TODO） */
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

/** 通算分（0:00 起点）を "H:MM" 文字列にする */
function hhmm(totalMin: number): string {
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** その日の営業帯を返す */
function todayRanges(shop: Shop, now: Date): readonly TimeRange[] {
  return isWeekend(now) ? shop.weekend : shop.weekday
}

/** 現在時刻に対する店の状態を計算 */
export function getShopStatus(shop: Shop, now: Date): ShopStatus {
  const ranges = todayRanges(shop, now)
  const nowMin = now.getHours() * 60 + now.getMinutes()

  if (ranges.length === 0) return { state: 'closed', label: '定休' }

  for (const range of ranges) {
    if (nowMin >= range.open && nowMin < range.close) {
      const left = range.close - nowMin
      if (left <= CLOSING_SOON_MIN) {
        return { state: 'closing-soon', label: `あと${left}分で閉店` }
      }
      return { state: 'open', label: `営業中 〜${hhmm(range.close)}` }
    }
  }

  let nextOpen = Number.POSITIVE_INFINITY
  for (const range of ranges) {
    if (range.open > nowMin && range.open < nextOpen) nextOpen = range.open
  }
  if (nextOpen !== Number.POSITIVE_INFINITY) {
    return { state: 'closed', label: `${hhmm(nextOpen)}開店` }
  }
  return { state: 'closed', label: '本日終了' }
}

/** 状態マーク（●営業中 ◐閉店間際 ○閉店） */
export function statusMark(shop: Shop, now: Date): string {
  const { state } = getShopStatus(shop, now)
  return state === 'open' ? '●' : state === 'closing-soon' ? '◐' : '○'
}

// ─── 距離 ───

/** 度をラジアンに変換 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/** 2点間の距離（メートル）。ハバーサイン公式 */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** 距離の表示用フォーマット（〜1km は m、それ以上は km） */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// ─── ジャンル・近い順 ───

/** 重複なしのジャンル一覧（出現順） */
export function listGenres(allShops: readonly Shop[]): string[] {
  return [...new Set(allShops.map((s) => s.genre))]
}

export interface NearbyItem {
  readonly shop: Shop
  readonly meters: number
}

/**
 * 近い順で表示する最大件数。
 * 登録店が増えても1件ずつのスワイプ閲覧が重くならないための上限。
 */
export const NEAREST_LIMIT = 20

/**
 * ジャンルで絞り、原点から近い順に並べて上位 limit 件を返す（genre=null は全件）。
 */
export function nearbyByGenre(
  allShops: readonly Shop[],
  genre: string | null,
  origin: GeoPoint,
  limit: number = NEAREST_LIMIT,
): NearbyItem[] {
  return allShops
    .filter((s) => genre === null || s.genre === genre)
    .map((s) => ({ shop: s, meters: haversineMeters(origin, s) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit)
}

/**
 * 近い順リストに実際に表示される件数だけを返す（距離計算・ソートをしない軽量版）。
 * ハイライト移動の範囲計算など、件数のみ必要な場面で使う。
 */
export function countNearby(
  allShops: readonly Shop[],
  genre: string | null,
  limit: number = NEAREST_LIMIT,
): number {
  const matched = allShops.filter(
    (s) => genre === null || s.genre === genre,
  ).length
  return Math.min(matched, limit)
}
