import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { type AppSnapshot, onGlassAction, toDisplayData } from './selectors'
import type { AppActions } from './shared'
import { appSplash } from './splash'

const GLASS_ROUTES = {
  home: '/',
  train: '/train',
  gourmet: '/gourmet',
} as const

const deriveScreen = createScreenMapper(
  [
    { pattern: GLASS_ROUTES.home, screen: 'home' },
    { pattern: GLASS_ROUTES.train, screen: 'train' },
    { pattern: GLASS_ROUTES.gourmet, screen: 'gourmet' },
  ],
  'home',
)

const homeTiles = getHomeTiles(appSplash)

export function AppGlasses() {
  const navigate = useNavigate()
  const location = useLocation()
  const flashPhase = useFlashPhase(deriveScreen(location.pathname) === 'home')

  const snapshotRef = useMemo(
    () => ({
      current: null as AppSnapshot | null,
    }),
    [],
  )

  const snapshot: AppSnapshot = {
    menuItems: [
      { label: '電車情報', path: GLASS_ROUTES.train },
      { label: 'グルメ情報', path: GLASS_ROUTES.gourmet },
    ],
    flashPhase,
  }
  snapshotRef.current = snapshot

  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  const ctxRef = useRef<AppActions>({ navigate })
  ctxRef.current = { navigate }

  const handleGlassAction = useCallback(
    (
      action: Parameters<typeof onGlassAction>[0],
      nav: Parameters<typeof onGlassAction>[1],
      snap: AppSnapshot,
    ) => onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  useGlasses({
    getSnapshot,
    toDisplayData,
    onGlassAction: handleGlassAction,
    deriveScreen,
    appName: 'HISHO',
    splash: appSplash,
    getPageMode: (screen) => (screen === 'home' ? 'home' : 'text'),
    homeImageTiles: homeTiles,
  })

  return null
}
