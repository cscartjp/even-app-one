import {
  type EvenAppBridge,
  ImuReportPace,
  OsEventTypeList,
  waitForEvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { type Dispatch, useCallback, useEffect, useRef } from 'react'
import type { Action } from './reducer'
import type { Pace } from './state'

// ブリッジが注入されない環境（ブラウザプレビュー）では waitForEvenAppBridge() が
// 解決しないため、この時間で諦めて connected=false のまま動かす（g2hermes 踏襲）。
const BRIDGE_WAIT_MS = 1500

/** pace（ms）→ SDK の ImuReportPace 列挙。値は一致するが型として明示変換する。 */
const PACE_ENUM: Record<Pace, ImuReportPace> = {
  100: ImuReportPace.P100,
  500: ImuReportPace.P500,
  1000: ImuReportPace.P1000,
}

/** 装着グラスのバッテリー残量（%）を読む。失敗時は null。 */
async function readBattery(bridge: EvenAppBridge): Promise<number | null> {
  try {
    const info = await bridge.getDeviceInfo()
    const level = info?.status?.batteryLevel
    return typeof level === 'number' ? level : null
  } catch {
    return null
  }
}

export interface ImuControls {
  /** 計測開始（imuControl(true, pace)）。 */
  start: (pace: Pace) => void
  /** 計測停止（imuControl(false)）。 */
  stop: () => void
  /** pace 変更（計測中なら開き直す）。 */
  setPace: (pace: Pace) => void
  /** スマホ振動テスト。鳴ったか（API が存在し true を返したか）を返す。 */
  vibrate: (pattern?: number | number[]) => boolean
}

/**
 * ブリッジ配線フック。IMU の開閉・購読・バッテリー取得を担い、結果を
 * reducer の dispatch に流す。状態の正本は App（useReducer）側。
 * SDK 非提供環境では connected=false のまま no-op で安全に動く。
 */
export function useImu(dispatch: Dispatch<Action>): ImuControls {
  const bridgeRef = useRef<EvenAppBridge | null>(null)
  // 計測中フラグ（同期）。pace 変更時に「計測中だけ開き直す」判定に使う。
  const measuringRef = useRef(false)

  // マウント時にブリッジへ接続し、IMU イベントを購読する。
  useEffect(() => {
    let disposed = false
    let unsubscribe: (() => void) | null = null

    void Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), BRIDGE_WAIT_MS),
      ),
    ]).then(async (bridge) => {
      if (disposed || !bridge) return
      bridgeRef.current = bridge
      dispatch({ type: 'CONNECTED', connected: true })
      dispatch({ type: 'BATTERY', level: await readBattery(bridge) })

      unsubscribe = bridge.onEvenHubEvent((event) => {
        if (event.sysEvent?.eventType !== OsEventTypeList.IMU_DATA_REPORT)
          return
        const d = event.sysEvent.imuData
        if (!d) return
        dispatch({
          type: 'SAMPLE',
          sample: {
            t: performance.now(),
            x: d.x ?? 0,
            y: d.y ?? 0,
            z: d.z ?? 0,
          },
        })
      })
    })

    return () => {
      disposed = true
      unsubscribe?.()
      // アンマウント時は必ず IMU を閉じる（電池保護）。
      void bridgeRef.current?.imuControl(false).catch(() => {})
      bridgeRef.current = null
    }
  }, [dispatch])

  const start = useCallback(
    (pace: Pace) => {
      const bridge = bridgeRef.current
      measuringRef.current = true
      void (async () => {
        const battery = bridge ? await readBattery(bridge) : null
        dispatch({ type: 'START', pace, battery })
        await bridge?.imuControl(true, PACE_ENUM[pace]).catch(() => {})
      })()
    },
    [dispatch],
  )

  const stop = useCallback(() => {
    measuringRef.current = false
    void bridgeRef.current?.imuControl(false).catch(() => {})
    dispatch({ type: 'STOP' })
  }, [dispatch])

  const setPace = useCallback(
    (pace: Pace) => {
      dispatch({ type: 'SET_PACE', pace })
      // 計測中の pace 変更だけ開き直す。停止中は次回 start に効く。
      if (!measuringRef.current) return
      void bridgeRef.current?.imuControl(true, PACE_ENUM[pace]).catch(() => {})
    },
    [dispatch],
  )

  const vibrate = useCallback((pattern: number | number[] = 200) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      return navigator.vibrate(pattern)
    }
    return false
  }, [])

  return { start, stop, setPace, vibrate }
}
