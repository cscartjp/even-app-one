import { createScreenMapper, getHomeTiles } from 'even-toolkit/glass-router'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { defaultOrigin, defaultOriginLabel, type GeoPoint } from '../data/shops'
import { type AppSnapshot, onGlassAction, toDisplayData } from './selectors'
import type { AppActions } from './shared'
import { appSplash } from './splash'

const GLASS_ROUTES = {
  home: '/',
  train: '/train',
  gourmet: '/gourmet',
  gourmetNearby: '/gourmet/nearby',
} as const

const deriveScreen = createScreenMapper(
  [
    { pattern: GLASS_ROUTES.home, screen: 'home' },
    { pattern: GLASS_ROUTES.train, screen: 'train' },
    { pattern: GLASS_ROUTES.gourmetNearby, screen: 'gourmetNearby' },
    { pattern: GLASS_ROUTES.gourmet, screen: 'gourmet' },
  ],
  'home',
)

const homeTiles = getHomeTiles(appSplash)

/**
 * グラス表示のブリッジ。React Router の現在地から画面を導出し、
 * 状態（原点・選択ジャンル）と GPS 取得を管理して useGlasses に渡す。
 */
export function AppGlasses() {
  const navigate = useNavigate()
  const location = useLocation()
  const flashPhase = useFlashPhase(deriveScreen(location.pathname) === 'home')

  // 距離計算の原点。既定は駅。GPS が取れたら現在地に差し替える（ハイブリッド）
  const [origin, setOrigin] = useState<GeoPoint>(defaultOrigin)
  const [originLabel, setOriginLabel] = useState<string>(defaultOriginLabel)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)

  // 分単位の時刻カウンタ。分が変わるたびに更新し、全画面のステータスバー時計を再描画させる。
  // minuteTick 自体は snapshot に含めず、state 変化による再レンダーだけを利用する。
  // BLE 帯域節約のため 1 秒間隔ではなく分境界（setTimeout → setInterval）で更新する。
  const [, setMinuteTick] = useState(() => Math.floor(Date.now() / 60000))

  useEffect(() => {
    // 次の分境界まで待機してから毎分更新するインターバルを開始する
    const msUntilNextMinute = 60000 - (Date.now() % 60000)
    let intervalId: ReturnType<typeof setInterval> | null = null
    const timeoutId = setTimeout(() => {
      setMinuteTick(Math.floor(Date.now() / 60000))
      intervalId = setInterval(() => {
        setMinuteTick(Math.floor(Date.now() / 60000))
      }, 60000)
    }, msUntilNextMinute)
    return () => {
      clearTimeout(timeoutId)
      if (intervalId !== null) clearInterval(intervalId)
    }
  }, [])

  // ベストエフォートで現在地を監視（HTTPS等で不可なら既定駅のまま）。
  // Hub の WebView では getCurrentPosition(timeout付き) が初回フィックス前に
  // タイムアウトしやすく、コミュニティでは watchPosition の動作実績あり
  // （docs/community/jp-articles/02-bigdra-sdk-features.md）。
  // タイムアウトは設けず、フィックスが来るたびに原点を更新する。
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setOriginLabel('現在地')
      },
      () => {
        // 取得失敗・拒否・非セキュアコンテキスト → 既定駅のまま
      },
      { maximumAge: 60000 },
    )
    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

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
    origin,
    originLabel,
    selectedGenre,
  }
  snapshotRef.current = snapshot

  // biome-ignore lint/style/noNonNullAssertion: 直前のレンダーで必ず代入済み
  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  const ctxRef = useRef<AppActions>({ navigate, setGenre: setSelectedGenre })
  ctxRef.current = { navigate, setGenre: setSelectedGenre }

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
