import { type Dispatch, useState } from 'react'
import { appVersion } from '../glass/screen'
import { formatCsv, norm, roundDeg, type Vec3 } from '../imu/math'
import type { Action, ReducerState } from '../imu/reducer'
import { deriveTheta, PACE_OPTIONS, type Pace } from '../imu/state'
import type { ImuControls } from '../imu/useImu'

interface ImuLabProps {
  state: ReducerState
  dispatch: Dispatch<Action>
  controls: ImuControls
}

const f2 = (v: number) => v.toFixed(2)

function VecRow({ label, v }: { label: string; v: Vec3 | null }) {
  return (
    <div className="row">
      <span className="k">{label}</span>
      <span className="v">
        {v ? `x ${f2(v.x)}   y ${f2(v.y)}   z ${f2(v.z)}` : '— 未受信'}
      </span>
    </div>
  )
}

/**
 * IMU Lab の主計測 UI（スマホ WebView の DOM）。
 * グラスは数行の副表示なので、生値・派生値・ログ・各種テストはここで見る。
 */
export function ImuLab({ state, dispatch, controls }: ImuLabProps) {
  const [msg, setMsg] = useState<string>('')

  const theta = deriveTheta(state)
  const batteryDelta =
    state.batteryAtStart != null && state.battery != null
      ? state.batteryAtStart - state.battery
      : null

  const onCopy = async () => {
    const csv = formatCsv(state.log)
    try {
      await navigator.clipboard.writeText(csv)
      setMsg(`CSV ${state.log.length} 件をコピーしました`)
    } catch {
      // クリップボード不可の環境では console に出す（持ち帰り手段）
      console.log(csv)
      setMsg('クリップボード不可 → console に出力しました')
    }
  }

  const onVibrate = () => {
    const ok = controls.vibrate([200, 100, 200])
    setMsg(ok ? '振動 API: true（呼べた）' : '振動 API: false（非対応）')
  }

  return (
    <main className="lab">
      <header>
        <h1>IMU Lab v{appVersion()}</h1>
        <span className={`badge ${state.connected ? 'on' : 'off'}`}>
          {state.connected ? 'bridge 接続' : 'bridge 未接続'}
        </span>
      </header>

      <section className="controls">
        {state.measuring ? (
          <button
            type="button"
            className="primary stop"
            onClick={controls.stop}
          >
            ■ 計測停止
          </button>
        ) : (
          <button
            type="button"
            className="primary"
            onClick={() => controls.start(state.pace)}
          >
            ● 計測開始
          </button>
        )}

        <div className="pace">
          {PACE_OPTIONS.map((p: Pace) => (
            <button
              type="button"
              key={p}
              className={state.pace === p ? 'sel' : ''}
              onClick={() => controls.setPace(p)}
            >
              P{p}
            </button>
          ))}
        </div>
      </section>

      <section className="actions">
        <button type="button" onClick={() => dispatch({ type: 'CALIBRATE' })}>
          📐 キャリブ（良い姿勢で静止して）
        </button>
        <button type="button" onClick={onVibrate}>
          📳 振動テスト
        </button>
        <button type="button" onClick={() => dispatch({ type: 'CLEAR' })}>
          🗑 ログクリア
        </button>
        <button type="button" onClick={onCopy}>
          📋 CSV コピー
        </button>
      </section>

      {msg && <p className="msg">{msg}</p>}

      <section className="readout">
        <VecRow label="生値" v={state.latest} />
        <VecRow label="平滑(1.5s)" v={state.smoothed} />
        <VecRow label="基準(calib)" v={state.calib} />
        <div className="row">
          <span className="k">|v| ノルム</span>
          <span className="v">
            {state.latest ? f2(norm(state.latest)) : '—'}
          </span>
        </div>
        <div className="row big">
          <span className="k">θ 前傾角（猫背指標）</span>
          <span className="v">
            {theta == null
              ? state.calib
                ? '— 受信待ち'
                : '— 要キャリブ'
              : `${roundDeg(theta)}°`}
          </span>
        </div>
      </section>

      <section className="stats">
        <div>
          <span className="k">実効レート</span>
          <span className="v">
            {state.rateHz > 0 ? `${state.rateHz.toFixed(1)} Hz` : '—'}
          </span>
        </div>
        <div>
          <span className="k">サンプル数</span>
          <span className="v">{state.sampleCount}</span>
        </div>
        <div>
          <span className="k">バッテリー</span>
          <span className="v">
            {state.battery == null ? '—' : `${state.battery}%`}
          </span>
        </div>
        <div>
          <span className="k">消費(開始比)</span>
          <span className="v">
            {batteryDelta == null ? '—' : `${batteryDelta}%`}
          </span>
        </div>
      </section>

      <section className="log">
        <h2>直近ログ（{state.log.length} 件 / CSV はコピー可）</h2>
        <pre>
          {state.log
            .slice(-8)
            .reverse()
            .map(
              (s) =>
                `${Math.round(s.t)}  x${f2(s.x)} y${f2(s.y)} z${f2(s.z)}  |v|${f2(norm(s))}`,
            )
            .join('\n') || '（まだサンプルがありません）'}
        </pre>
      </section>

      <footer>
        <p>
          スパイク用。実機（QR サイドロード）で生値の素性・実レート・振動可否・
          電池消費を確認する。グラスはタップで計測 ON/OFF、↕で
          pace、ダブルタップで終了。
        </p>
      </footer>
    </main>
  )
}
