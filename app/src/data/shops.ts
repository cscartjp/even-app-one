/**
 * グルメ（お気に入りの店）データ
 *
 * ★ これはサンプルデータです。自分の行きつけの店に差し替えてください。
 *   座標(lat/lon)も Google マップで右クリック→座標コピーで簡単に取れます。
 *
 * 営業時間は「今開いてるか」の判定に使う。曜日は平日(weekday)／土日(weekend)で分け、
 * 各日に複数の営業帯（昼／夜など）を持てる。空配列＝その曜日は定休。
 *
 * TODO: 祝日カレンダー（train の isWeekend と共通化）／日付をまたぐ深夜営業
 */

/** 緯度・経度 */
export interface GeoPoint {
  readonly lat: number
  readonly lon: number
}

/** 1日の中の営業帯。分は 0:00 からの通算分（例: 11:30 → 690）。 */
export interface TimeRange {
  /** 開店（通算分） */
  readonly open: number
  /** 閉店（通算分）。深夜営業は未対応のため 24:00 = 1440 までを想定 */
  readonly close: number
}

export interface Shop {
  /** 店名（リストは1行64字まで。短めに） */
  readonly name: string
  /** ジャンル（ラーメン / 定食 / カフェ…）。ジャンル選択の選択肢になる */
  readonly genre: string
  /** エリア（最寄り駅など） */
  readonly area?: string
  /** 緯度 */
  readonly lat: number
  /** 経度 */
  readonly lon: number
  /** 平日の営業帯。空＝定休 */
  readonly weekday: readonly TimeRange[]
  /** 土日の営業帯。空＝定休 */
  readonly weekend: readonly TimeRange[]
  /** 一言メモ（「現金のみ」「火曜定休」など） */
  readonly note?: string
}

/** "HH:MM" 2点から営業帯を作るヘルパー */
const r = (
  openH: number,
  openM: number,
  closeH: number,
  closeM: number,
): TimeRange => ({
  open: openH * 60 + openM,
  close: closeH * 60 + closeM,
})

/**
 * GPS が取れなかったときに使う既定の原点（大保駅）。
 * グルメの距離計算と、電車画面の最寄り駅判定（stations.ts）の両方で使う。
 */
export const defaultOrigin: GeoPoint = {
  lat: 33.41204059715683,
  lon: 130.55815821600282,
}
export const defaultOriginLabel = '大保駅'

// ─── サンプル：西鉄天神大牟田線 大保駅まわり ───
// 実在店の正確な営業時間・座標ではありません。自分のリストに置き換えてください。

export const shops: readonly Shop[] = [
  {
    name: '大保らーめん',
    genre: 'ラーメン',
    area: '大保',
    lat: 33.491,
    lon: 130.471,
    weekday: [r(11, 0, 15, 0), r(18, 0, 22, 0)],
    weekend: [r(11, 0, 22, 0)],
    note: '日曜は通し営業',
  },
  {
    name: 'うどん 筑紫',
    genre: 'うどん',
    area: '筑紫',
    lat: 33.47,
    lon: 130.48,
    weekday: [r(10, 30, 19, 0)],
    weekend: [r(10, 30, 16, 0)],
  },
  {
    name: '定食 こまつ',
    genre: '定食',
    area: '小郡',
    lat: 33.395,
    lon: 130.553,
    weekday: [r(11, 0, 14, 30), r(17, 30, 21, 0)],
    weekend: [],
    note: '土日定休',
  },
  {
    name: 'カフェ 桜台',
    genre: 'カフェ',
    area: '桜台',
    lat: 33.48,
    lon: 130.475,
    weekday: [r(8, 0, 18, 0)],
    weekend: [r(9, 0, 18, 0)],
    note: '木曜定休（祝日除く）',
  },
  {
    name: '居酒屋 大善寺',
    genre: '居酒屋',
    area: '大善寺',
    lat: 33.29,
    lon: 130.53,
    weekday: [r(17, 0, 23, 0)],
    weekend: [r(16, 0, 23, 0)],
    note: '現金のみ',
  },
  {
    name: 'パン工房 二日市',
    genre: 'ベーカリー',
    area: '二日市',
    lat: 33.5,
    lon: 130.52,
    weekday: [r(7, 0, 19, 0)],
    weekend: [r(7, 0, 19, 0)],
    note: '売り切れ次第終了',
  },
  {
    name: '大保食堂',
    genre: '定食',
    area: '大保',
    lat: 33.489,
    lon: 130.469,
    weekday: [r(11, 0, 20, 0)],
    weekend: [r(11, 0, 20, 0)],
  },
  {
    name: '天神らーめん',
    genre: 'ラーメン',
    area: '天神',
    lat: 33.5908,
    lon: 130.3998,
    weekday: [r(11, 0, 23, 0)],
    weekend: [r(11, 0, 23, 0)],
  },
  {
    name: '天神カフェ',
    genre: 'カフェ',
    area: '天神',
    lat: 33.5895,
    lon: 130.3975,
    weekday: [r(8, 0, 21, 0)],
    weekend: [r(8, 0, 21, 0)],
  },
]
