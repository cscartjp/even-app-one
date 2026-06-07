import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router'
import { gourmetScreen } from './screens/gourmet'
import { gourmetNearbyScreen } from './screens/gourmet-nearby'
import { homeScreen } from './screens/home'
import { stationSelectScreen } from './screens/station-select'
import { trainScreen } from './screens/train'
import type { AppActions, AppSnapshot } from './shared'

export type { AppActions, AppSnapshot }

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
