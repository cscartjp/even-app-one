/**
 * 駅マスタ（西鉄天神大牟田線・時刻表データを持つ4駅）
 *
 * 緯度経度から最寄り駅を判定し、電車画面に出す時刻表を切り替えるための紐付け。
 * GPS 権限は Hub 経由（In Development）でのみ有効なので、
 * サイドロード時は既定 origin の最寄り駅が表示される。
 */

import { haversineMeters } from './gourmet'
import { hanabatakeDirections } from './hanabatake-timetable'
import { ogoriDirections } from './ogori-timetable'
import type { DirectionSchedule } from './oho-timetable'
import { ohoDirections } from './oho-timetable'
import type { GeoPoint } from './shops'
import { tenjinDirections } from './tenjin-timetable'

export interface Station {
  /** ヘッダー表示用の駅名（短め） */
  readonly name: string
  /** 駅の座標 */
  readonly lat: number
  readonly lon: number
  /** この駅で表示できる方面（1〜2件） */
  readonly directions: readonly DirectionSchedule[]
}

export const stations: readonly Station[] = [
  {
    name: '大保',
    lat: 33.41204059715683,
    lon: 130.55815821600282,
    directions: ohoDirections,
  },
  {
    name: '西鉄小郡',
    lat: 33.39631904284256,
    lon: 130.55353480813636,
    directions: ogoriDirections,
  },
  {
    name: '花畑',
    lat: 33.30613097245831,
    lon: 130.51519225415385,
    directions: hanabatakeDirections,
  },
  {
    name: '西鉄福岡(天神)',
    lat: 33.58912807066921,
    lon: 130.39993557532804,
    directions: tenjinDirections,
  },
]

/** 原点（GPS 現在地または既定値）に最も近い駅を返す */
export function nearestStation(origin: GeoPoint): Station {
  let best = stations[0]
  let bestMeters = haversineMeters(origin, best)
  for (const station of stations.slice(1)) {
    const meters = haversineMeters(origin, station)
    if (meters < bestMeters) {
      best = station
      bestMeters = meters
    }
  }
  return best
}
