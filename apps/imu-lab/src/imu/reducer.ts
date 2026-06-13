// IMU Lab の状態遷移（純粋）。App が useReducer で持ち、useImu からのサンプルと
// UI 操作（開始/停止/キャリブ/pace/クリア）を畳み込む。SDK 非依存。

import type { ImuSample, Vec3 } from './math'
import { movingAverageVec, rateHz } from './math'
import { initialLabState, type LabState, type Pace } from './state'

/** 平滑窓（ms）。歩行ノイズを均して重力成分を取り出す。 */
export const SMOOTH_WINDOW_MS = 1500
/** レート/平滑に使う直近サンプルの最大保持数。 */
export const RECENT_MAX = 200
/** CSV 持ち帰り用ログの最大保持数（古いものから捨てる）。 */
export const LOG_MAX = 3000

export interface ReducerState extends LabState {
  /** 直近サンプル（平滑・レート算出用、時間/件数で上限）。 */
  recent: ImuSample[]
  /** 持ち帰り用ログ（件数上限のリングバッファ）。 */
  log: ImuSample[]
}

export const initialState: ReducerState = {
  ...initialLabState,
  recent: [],
  log: [],
}

export type Action =
  | { type: 'CONNECTED'; connected: boolean }
  | { type: 'BATTERY'; level: number | null }
  | { type: 'START'; pace: Pace; battery: number | null }
  | { type: 'STOP' }
  | { type: 'SET_PACE'; pace: Pace }
  | { type: 'SAMPLE'; sample: ImuSample }
  | { type: 'CALIBRATE' }
  | { type: 'CLEAR' }

/** 直近列を時間窓 + 件数でトリムする。 */
function trimRecent(recent: ImuSample[], now: number): ImuSample[] {
  const cutoff = now - SMOOTH_WINDOW_MS
  const windowed = recent.filter((s) => s.t >= cutoff)
  return windowed.length > RECENT_MAX
    ? windowed.slice(windowed.length - RECENT_MAX)
    : windowed
}

export function reduce(state: ReducerState, action: Action): ReducerState {
  switch (action.type) {
    case 'CONNECTED':
      return { ...state, connected: action.connected }

    case 'BATTERY':
      return { ...state, battery: action.level }

    case 'START':
      return {
        ...state,
        measuring: true,
        pace: action.pace,
        battery: action.battery ?? state.battery,
        batteryAtStart: action.battery ?? state.battery,
      }

    case 'STOP':
      return { ...state, measuring: false, rateHz: 0 }

    case 'SET_PACE':
      return { ...state, pace: action.pace }

    case 'SAMPLE': {
      const recent = trimRecent(
        [...state.recent, action.sample],
        action.sample.t,
      )
      const smoothed: Vec3 = movingAverageVec(recent)
      const log = [...state.log, action.sample]
      const trimmedLog =
        log.length > LOG_MAX ? log.slice(log.length - LOG_MAX) : log
      return {
        ...state,
        latest: action.sample,
        smoothed,
        recent,
        log: trimmedLog,
        rateHz: rateHz(recent.map((s) => s.t)),
        sampleCount: state.sampleCount + 1,
      }
    }

    case 'CALIBRATE': {
      // 「今の姿勢」を基準に。平滑値があれば優先（静止 1.5s 推奨）。
      const calib = state.smoothed ?? state.latest
      return calib ? { ...state, calib: { ...calib } } : state
    }

    case 'CLEAR':
      return {
        ...state,
        log: [],
        recent: [],
        latest: null,
        smoothed: null,
        rateHz: 0,
        sampleCount: 0,
      }

    default:
      return state
  }
}
