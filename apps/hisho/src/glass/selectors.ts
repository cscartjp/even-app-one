import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router'
import type { GlassNavState, SplitData } from 'even-toolkit/types'
import { gourmetScreen } from './screens/gourmet'
import {
  gourmetNearbyScreen,
  gourmetNearbySplit,
} from './screens/gourmet-nearby'
import { homeScreen } from './screens/home'
import { stationSelectScreen } from './screens/station-select'
import { trainScreen } from './screens/train'
import type { AppActions, AppSnapshot } from './shared'

export type { AppActions, AppSnapshot }

/**
 * split モードのデータ供給。getPageMode が 'split' を返すのは gourmetNearby のみ。
 * ガード: 他画面で誤って呼ばれても gourmetNearby のビルダーは snapshot だけから
 * 安全に描画できる（クラッシュしない）ため、そのまま委譲する。
 */
export function toSplit(snapshot: AppSnapshot, nav: GlassNavState): SplitData {
  return gourmetNearbySplit(snapshot, nav)
}

export const { toDisplayData, onGlassAction } = createGlassScreenRouter<
  AppSnapshot,
  AppActions
>(
  {
    home: homeScreen,
    train: trainScreen,
    gourmet: gourmetScreen,
    gourmetNearby: gourmetNearbyScreen,
    station: stationSelectScreen,
  },
  'home',
)
