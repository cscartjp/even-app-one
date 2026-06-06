/**
 * グルメ（お気に入りの店）データ
 *
 * ★ これはサンプルデータです。自分の行きつけの店に差し替えてください。
 *   （oho-timetable.ts と同じく、静的データを手で用意するだけ）
 *
 * 営業時間は「今開いてるか」の判定に使う。曜日は平日(weekday)／土日(weekend)で分け、
 * 各日に複数の営業帯（昼／夜など）を持てる。空配列＝その曜日は定休。
 *
 * TODO: 祝日カレンダー（train の isWeekend と共通化）／日付をまたぐ深夜営業
 */

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
  /** ジャンル（ラーメン / 定食 / カフェ…） */
  readonly genre: string
  /** エリア（最寄り駅など） */
  readonly area?: string
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

// ─── サンプル：西鉄天神大牟田線 大保駅まわり ───
// 実在店の正確な営業時間ではありません。自分のリストに置き換えてください。

export const shops: readonly Shop[] = [
  {
    name: '大保らーめん',
    genre: 'ラーメン',
    area: '大保',
    weekday: [r(11, 0, 15, 0), r(18, 0, 22, 0)],
    weekend: [r(11, 0, 22, 0)],
    note: '日曜は通し営業',
  },
  {
    name: 'うどん 筑紫',
    genre: 'うどん',
    area: '筑紫',
    weekday: [r(10, 30, 19, 0)],
    weekend: [r(10, 30, 16, 0)],
  },
  {
    name: '定食 こまつ',
    genre: '定食',
    area: '小郡',
    weekday: [r(11, 0, 14, 30), r(17, 30, 21, 0)],
    weekend: [],
    note: '土日定休',
  },
  {
    name: 'カフェ 桜台',
    genre: 'カフェ',
    area: '桜台',
    weekday: [r(8, 0, 18, 0)],
    weekend: [r(9, 0, 18, 0)],
    note: '木曜定休（祝日除く）',
  },
  {
    name: '居酒屋 大善寺',
    genre: '居酒屋',
    area: '大善寺',
    weekday: [r(17, 0, 23, 0)],
    weekend: [r(16, 0, 23, 0)],
    note: '現金のみ',
  },
  {
    name: 'パン工房 二日市',
    genre: 'ベーカリー',
    area: '二日市',
    weekday: [r(7, 0, 19, 0)],
    weekend: [r(7, 0, 19, 0)],
    note: '売り切れ次第終了',
  },
]
