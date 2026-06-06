import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { type AppSnapshot, onGlassAction, toDisplayData } from './selectors'
import type { AppActions } from './shared'
import { appSplash } from './splash'

const deriveScreen = createScreenMapper(
  [
    { pattern: '/', screen: 'home' },
    { pattern: '/train', screen: 'train' },
    { pattern: '/gourmet', screen: 'gourmet' },
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
      { label: '電車情報', path: '/train' },
      { label: 'グルメ情報', path: '/gourmet' },
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
