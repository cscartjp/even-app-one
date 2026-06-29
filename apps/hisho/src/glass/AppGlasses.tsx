import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createScreenMapper } from 'even-toolkit/glass-router'
import { useFlashPhase } from 'even-toolkit/useFlashPhase'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { defaultOrigin, defaultOriginLabel, type GeoPoint } from '../data/shops'
import { stations } from '../data/stations'
import { type AppSnapshot, onGlassAction } from './selectors'
import type { AppActions } from './shared'
import { loadStationName, saveStationName } from './storage'
import { useHishoGlasses } from './useHishoGlasses'

const GLASS_ROUTES = {
  home: '/',
  train: '/train',
  station: '/station',
  gourmet: '/gourmet',
  gourmetNearby: '/gourmet/nearby',
} as const

const deriveScreen = createScreenMapper(
  [
    { pattern: GLASS_ROUTES.home, screen: 'home' },
    { pattern: GLASS_ROUTES.train, screen: 'train' },
    { pattern: GLASS_ROUTES.station, screen: 'station' },
    // gourmetNearby は gourmet より前（プレフィックス衝突回避）
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
  // 手動選択駅。null は「自動（GPS > 既定）」モード
  const [selectedStation, setSelectedStation] = useState<string | null>(null)

  // 起動時に保存済み駅名を読み込む（1 回のみ）
  useEffect(() => {
    loadStationName().then((name) => {
      if (name === null) return
      // stations マスタと突き合わせ、存在しない駅名は null 扱い（古い保存値の保険）
      const known = stations.some((s) => s.name === name)
      if (!known) return
      setSelectedStation(name)
    })
  }, [])

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

  // ベストエフォートで現在地を取得（取れなければ既定駅のまま）。
  // SDK 0.0.11 のネイティブ位置 API bridge.getAppLocation()（ホスト経由）を使う。
  // 従来の WebView 標準 navigator.geolocation は Hub 経由でも取得できなかったため不採用
  // （Android 実機で getAppLocation は成功・2026-06-29 確認）。
  // 自動モード（手動選択駅なし）のときだけ、起動時に 1 回だけ取得する。
  useEffect(() => {
    // 手動選択駅があるときは現在地を取らない（その駅を原点にする）
    if (selectedStation !== null) return
    let cancelled = false
    void (async () => {
      try {
        // dev / シミュレーターではブリッジが来ないので 3 秒で打ち切る
        let timer: ReturnType<typeof setTimeout> | undefined
        const bridge = await Promise.race([
          waitForEvenAppBridge(),
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 3000)
          }),
        ])
        clearTimeout(timer) // bridge 即解決時に残るタイマーを掃除
        if (cancelled || !bridge) return
        const loc = await bridge.getAppLocation({ timeoutMs: 15000 })
        if (cancelled || !loc) return
        setOrigin({ lat: loc.latitude, lon: loc.longitude })
        setOriginLabel('現在地')
      } catch {
        // 取得失敗時は既定駅のまま（origin / originLabel は初期値を維持）
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedStation])

  const snapshotRef = useMemo(
    () => ({
      current: null as AppSnapshot | null,
    }),
    [],
  )

  // 優先順位「手動 > GPS > 既定」で origin / originLabel を導出する
  // 手動選択駅がある場合は固定（GPS fix が来ても上書きしない）
  const resolvedOrigin: GeoPoint = useMemo(() => {
    if (selectedStation !== null) {
      const st = stations.find((s) => s.name === selectedStation)
      if (st) return { lat: st.lat, lon: st.lon }
    }
    return origin
  }, [selectedStation, origin])

  const resolvedOriginLabel: string =
    selectedStation !== null ? selectedStation : originLabel

  const snapshot: AppSnapshot = {
    menuItems: [
      { label: '電車情報', path: GLASS_ROUTES.train },
      { label: 'グルメ情報', path: GLASS_ROUTES.gourmet },
    ],
    flashPhase,
    origin: resolvedOrigin,
    originLabel: resolvedOriginLabel,
    selectedGenre,
    selectedStation,
  }
  snapshotRef.current = snapshot

  // biome-ignore lint/style/noNonNullAssertion: 直前のレンダーで必ず代入済み
  const getSnapshot = useCallback(() => snapshotRef.current!, [snapshotRef])

  // setStation: state 更新 + storage への永続化（失敗は黙殺 — storage 設計どおり）
  const handleSetStation = useCallback((name: string | null) => {
    setSelectedStation(name)
    void saveStationName(name)
  }, [])

  const ctxRef = useRef<AppActions>({
    navigate,
    setGenre: setSelectedGenre,
    setStation: handleSetStation,
  })
  ctxRef.current = {
    navigate,
    setGenre: setSelectedGenre,
    setStation: handleSetStation,
  }

  const handleGlassAction = useCallback(
    (
      action: Parameters<typeof onGlassAction>[0],
      nav: Parameters<typeof onGlassAction>[1],
      snap: AppSnapshot,
    ) => onGlassAction(action, nav, snap, ctxRef.current),
    [],
  )

  // ホーム描画は useHishoGlasses が raw SDK で角丸枠カード化する（issue #37）。
  // 画面判定（home / gourmetNearby=split / その他=text）はドライバ内部で行う。
  useHishoGlasses({
    getSnapshot,
    onGlassAction: handleGlassAction,
    deriveScreen,
  })

  return null
}
