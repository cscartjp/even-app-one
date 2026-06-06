import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router'
import { homeScreen } from './screens/home'
import type { AppActions, AppSnapshot } from './shared'

export type { AppActions, AppSnapshot }

export const { toDisplayData, onGlassAction } = createGlassScreenRouter<
  AppSnapshot,
  AppActions
>(
  {
    home: homeScreen,
  },
  'home',
)
