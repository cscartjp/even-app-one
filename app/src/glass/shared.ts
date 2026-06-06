import type { GeoPoint } from '../data/shops'

export interface MenuItem {
  label: string
  path: string
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
