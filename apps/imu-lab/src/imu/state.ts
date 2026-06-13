// IMU Lab の共有状態。App が正本として持ち、コンパニオン（スマホ DOM）と
// グラス表示（useGlasses）の両方が同じ state を読む。
// SDK 非依存（pace は数値で持ち、useImu 側で ImuReportPace に対応づける）。

import { angleBetweenDeg, type ImuSample, type Vec3 } from './math'

/** スパイクで試すレポート周期（ms）。bigdra 氏の実測で確認済みの 3 段階。 */
export const PACE_OPTIONS = [100, 500, 1000] as const
export type Pace = (typeof PACE_OPTIONS)[number]

/** 次の pace へ循環（グラスのスクロールで切替）。 */
export function cyclePace(current: Pace, dir: 'up' | 'down'): Pace {
  const i = PACE_OPTIONS.indexOf(current)
  const len = PACE_OPTIONS.length
  const next = dir === 'down' ? (i + 1) % len : (i - 1 + len) % len
  return PACE_OPTIONS[next]
}

/** 画面が読む計測スナップショット。 */
export interface LabState {
  /** ブリッジに接続できたか（false=ブラウザプレビュー/未接続）。 */
  connected: boolean
  /** 計測中か（imuControl(true) 済みか）。 */
  measuring: boolean
  /** 現在の pace（ms）。 */
  pace: Pace
  /** 直近サンプル（生値）。未受信なら null。 */
  latest: ImuSample | null
  /** 移動平均で均した重力ベクトル（歩行ノイズ除去後）。 */
  smoothed: Vec3 | null
  /** キャリブレーション基準（良い姿勢で静止して記録）。未取得なら null。 */
  calib: Vec3 | null
  /** 実効レート（Hz）。 */
  rateHz: number
  /** バッテリー残量（%）。取得不能なら null。 */
  battery: number | null
  /** 計測開始時のバッテリー残量（%）。電池消費の実測用。 */
  batteryAtStart: number | null
  /** 受信したサンプル総数。 */
  sampleCount: number
}

export const initialLabState: LabState = {
  connected: false,
  measuring: false,
  pace: 100,
  latest: null,
  smoothed: null,
  calib: null,
  rateHz: 0,
  battery: null,
  batteryAtStart: null,
  sampleCount: 0,
}

/**
 * 猫背検知の主指標 θ: キャリブレーション基準と「平滑後の現在ベクトル」のなす角。
 * 軸の割り当てが未知でも成立する（基準からどれだけ頭が傾いたか）。
 * 平滑値が無ければ生値で、基準やベクトルが無ければ null。
 */
export function deriveTheta(s: LabState): number | null {
  if (!s.calib) return null
  const cur = s.smoothed ?? s.latest
  if (!cur) return null
  return angleBetweenDeg(cur, s.calib)
}
