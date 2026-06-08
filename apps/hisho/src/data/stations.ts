/**
 * 駅マスタ（西鉄天神大牟田線・時刻表データを持つ4駅）
 *
 * 緯度経度から最寄り駅を判定し、電車画面に出す時刻表を切り替えるための紐付け。
 * GPS 権限は Hub 経由（In Development）でのみ有効なので、
 * サイドロード時は既定 origin の最寄り駅が表示される。
 */

import { haversineMeters } from './gourmet'
import { hanabatakeUp } from './hanabatake-timetable'
import { ogoriUp } from './ogori-timetable'
import { type DirectionSchedule, ohoDown, ohoUp } from './oho-timetable'
import type { GeoPoint } from './shops'
import { tenjinDown } from './tenjin-timetable'

export interface Station {
  /** ヘッダー表示用の駅名（短め） */
  readonly name: string
  /** 駅の座標 */
  readonly lat: number
  readonly lon: number
  /** この駅で表示できる方面（1〜2件・空配列は型で禁止） */
  readonly directions: readonly [DirectionSchedule, ...DirectionSchedule[]]
  /** 種別凡例（電車画面末尾に表示） */
  readonly legend: string
}

/** 西鉄福岡(天神)駅。GPS テスト中は既定 origin（shops.ts）もこの座標を参照する */
export const tenjinStation: Station = {
  name: '西鉄福岡(天神)',
  lat: 33.58912807066921,
  lon: 130.39993557532804,
  directions: [tenjinDown],
  legend: '◆特急 ★急行 無印=普通',
}

/** 大保駅。GPS 不可時の既定 origin（shops.ts）もこの座標を参照する */
export const ohoStation: Station = {
  name: '大保',
  lat: 33.41204059715683,
  lon: 130.55815821600282,
  directions: [ohoUp, ohoDown],
  legend: '★=筑紫から急行 無印=普通',
}

export const stations: readonly Station[] = [
  ohoStation,
  {
    name: '西鉄小郡',
    lat: 33.39631904284256,
    lon: 130.55353480813636,
    directions: [ogoriUp],
    legend: '◆特急 ★急行 無印=普通',
  },
  {
    name: '花畑',
    lat: 33.30613097245831,
    lon: 130.51519225415385,
    directions: [hanabatakeUp],
    legend: '◆特急 ★急行 無印=普通',
  },
  tenjinStation,
]

/** 原点（GPS 現在地または既定値）に最も近い駅を返す */
export function nearestStation(origin: GeoPoint): Station {
  let best: Station = ohoStation
  let bestMeters = haversineMeters(origin, best)
  for (let i = 1; i < stations.length; i++) {
    const station = stations[i]
    const meters = haversineMeters(origin, station)
    if (meters < bestMeters) {
      best = station
      bestMeters = meters
    }
  }
  return best
}
