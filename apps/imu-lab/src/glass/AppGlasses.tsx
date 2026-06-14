import { useGlasses } from 'even-toolkit/useGlasses'
import { useCallback, useMemo, useRef } from 'react'
import { requestExit } from '../even/bridge'
import { cyclePace as cyclePaceFn, type LabState } from '../imu/state'
import type { ImuControls } from '../imu/useImu'
import { type Ctx, labScreen } from './screen'

interface AppGlassesProps {
  /** 計測スナップショット（正本は App の useReducer）。 */
  state: LabState
  /** ブリッジ制御（開始/停止/pace）。 */
  controls: ImuControls
}

/**
 * グラス表示のブリッジ。状態は App が正本として持ち props で渡る。
 * useGlasses が 100ms ポーリングで snapshot 参照の変化を検知して再描画する。
 * グラス入力（タップ=計測 ON/OFF、↕=pace、ダブルタップ=終了）を controls に配線する。
 */
export function AppGlasses({ state, controls }: AppGlassesProps) {
  const stateRef = useRef(state)
  stateRef.current = state

  const toggle = useCallback(() => {
    const s = stateRef.current
    if (s.measuring) controls.stop()
    else controls.start(s.pace)
  }, [controls])

  const cyclePace = useCallback(
    (dir: 'up' | 'down') => {
      controls.setPace(cyclePaceFn(stateRef.current.pace, dir))
    },
    [controls],
  )

  const exit = useCallback(() => {
    void requestExit()
  }, [])

  const ctxRef = useRef<Ctx>({ toggle, cyclePace, exit })
  ctxRef.current = { toggle, cyclePace, exit }

  // 毎レンダーで新しい snapshot を作り ref に格納する（参照変化＝再描画トリガ）。
  const snapshotRef = useMemo(() => ({ current: null as LabState | null }), [])
  snapshotRef.current = state

  const getSnapshot = useCallback(
    // biome-ignore lint/style/noNonNullAssertion: 直前のレンダーで必ず代入済み
    () => snapshotRef.current!,
    [snapshotRef],
  )

  useGlasses<LabState>({
    getSnapshot,
    toDisplayData: (s) =>
      labScreen.display(s, { highlightedIndex: 0, screen: 'home' }),
    onGlassAction: (action, nav, s) =>
      labScreen.action(action, nav, s, ctxRef.current),
    deriveScreen: () => 'home',
    appName: 'IMU LAB',
    getPageMode: () => 'home',
    // GO_BACK（ダブルタップ）を自前 action（requestExit）で扱う。
    shutdownOnHomeBack: false,
  })

  return null
}
