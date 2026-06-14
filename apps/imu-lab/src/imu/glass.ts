// グラス表示（576×288・緑階調）の行生成。純関数で plain string[] を返し、
// GlassScreen 側で even-toolkit の line() に包む（テストは even-toolkit 非依存）。
// グラスは副の確認用 = 数行のみ。主計測 UI はスマホ（コンパニオン）側。

import { norm, roundDeg } from './math'
import { deriveTheta, type LabState } from './state'

/** 数値を符号付き固定幅で（例: ' 0.12' / '-9.81'）。 */
function fmt(v: number): string {
  return v.toFixed(2).padStart(6, ' ')
}

/**
 * グラスに出す行（プレーンテキスト）。
 * 1: タイトル + 版
 * 2: 状態（計測中/停止 + pace）
 * 3: x / y / z 生値
 * 4: norm / θ（猫背指標）
 * 5: Hz / battery
 * 6: 操作ヒント
 */
export function glassLines(s: LabState, version: string): string[] {
  const status = s.measuring ? `● 計測中 P${s.pace}` : '停止中'
  const conn = s.connected ? '' : ' (未接続)'

  const v = s.latest
  const xyz = v
    ? `x${fmt(v.x)}  y${fmt(v.y)}  z${fmt(v.z)}`
    : 'x  --   y  --   z  --'

  const n = v ? norm(v).toFixed(2) : '--'
  const theta = deriveTheta(s)
  const thetaStr = theta == null ? '--' : `${roundDeg(theta)}°`
  const calibTag = s.calib ? '' : ' (要キャリブ)'

  const hz = s.rateHz > 0 ? s.rateHz.toFixed(1) : '--'
  const bat = s.battery == null ? '--' : `${s.battery}%`

  return [
    `IMU Lab v${version}`,
    `${status}${conn}`,
    xyz,
    `|v| ${n}   θ ${thetaStr}${calibTag}`,
    `Hz ${hz}   bat ${bat}   n=${s.sampleCount}`,
    'タップ:計測ON/OFF  ↕:pace  2タップ:終了',
  ]
}
