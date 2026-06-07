import { createScreenMapper } from 'even-toolkit/glass-router'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { defaultOrigin, defaultOriginLabel, type GeoPoint } from '../data/shops'
import { type AppSnapshot, onGlassAction, toDisplayData } from './selectors'
import type { AppActions } from './shared'

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
  // 【GPS 診断・一時コード】Hub Beta 経由でも GPS 失敗が続くため、失敗箇所を
  // グルメ画面ヘッダーの originLabel に出して切り分ける。原因判明後は
  // サイレントフォールバック（既定駅のまま）に戻すこと。
  // 表示: [API無]=geolocation 未ブリッジ / [待機:g|d|p]=コールバック未着(+権限状態) /
  //       [E1|E2|E3:g|d|p]=拒否|測位不能|タイムアウト / 「現在地」=成功
  useEffect(() => {
    let gotFix = false
    let perm = ''
    let err = ''
    const renderNote = () => {
      if (gotFix) return
      setOriginLabel(
        `${defaultOriginLabel}[${[err || '待機', perm].filter(Boolean).join(':')}]`,
      )
    }
    if (!('geolocation' in navigator)) {
      setOriginLabel(`${defaultOriginLabel}[API無]`)
      return
    }
    renderNote()
    // 権限状態も証拠として取る（permissions API 未対応の WebView では無視）
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        perm = s.state[0] ?? ''
        renderNote()
      })
      .catch(() => {})
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setOriginLabel('現在地')
      },
      (e) => {
        err = `E${e.code}`
        renderNote()
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
    // 画像スプラッシュは使わない（テキスト「HISHO」描画のみで実質同等）。
    // splash があると splash が作った「ロゴ下端からのテキスト領域」レイアウトが
    // コールド起動の初回描画まで残り、ホームが上半分空白のまま切れる
    // （needsRebuild が false になり updateHomeText しか走らないため）。
    // ホームは常駐ロゴ画像なしの全面テキスト（ロゴタイルがあるとテキスト領域が
    // タイル下端からになり、グルメ情報以降が 288px に収まらない）
    getPageMode: (screen) => (screen === 'home' ? 'home' : 'text'),
  })

  return null
}
