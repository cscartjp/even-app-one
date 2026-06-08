import { GlassBridgeSource } from 'even-toolkit/stt'
import { concatChunks, MAX_RECORDING_MS } from '../audio/capture'

// Task 3.3.2 の音声キャプチャ機構。even-toolkit `GlassBridgeSource` を流用し
// （spec §4.4 / 判定D）、audioControl(true) → PCM(Float32) 蓄積 → stop で audioControl(false)
// までを 1 セッションに閉じる。`even-toolkit/stt`（index）は import 時に `window` を参照する
// WebView 専用モジュールなので、bridge.ts / lifecycle.ts と同じくこの `even/` 配下に隔離する
// （pure な WAV 化・ガードは audio/capture.ts 側でユニットテストする）。

/** 録音セッション。stop() でマイクを閉じ、録音した全 Float32 サンプルを返す。 */
export interface MicSession {
  /** マイクを閉じ（audioControl(false)）録音サンプルを返す。複数回呼んでも安全。 */
  stop: () => Promise<Float32Array>
}

export interface MicCaptureOptions {
  /** チャンク受信のたびに累計サンプル数を通知（録音時間表示の更新トリガ・任意）。 */
  onChunk?: (totalSamples: number) => void
  /** 最大録音時間に達したら呼ぶ（呼び出し側が stop→文字起こしへ進める）。 */
  onMaxDuration?: () => void
  /** 最大録音時間（既定 30s）。 */
  maxMs?: number
}

/**
 * グラスのマイクを開いて録音を開始する。`window.__evenBridge`（useGlasses が設定）が
 * 無い環境では `GlassBridgeSource.start()` が throw するので、呼び出し側で捕捉して
 * 「マイクを使えません」へ倒す（spec §5）。
 */
export async function startMicCapture(
  opts: MicCaptureOptions = {},
): Promise<MicSession> {
  const { onChunk, onMaxDuration, maxMs = MAX_RECORDING_MS } = opts
  const chunks: Float32Array[] = []
  let total = 0
  let stopped = false
  let maxTimer: ReturnType<typeof setTimeout> | undefined

  const source = new GlassBridgeSource()
  // bridge 不在なら throw（呼び出し側で error 表示へ）。マイクは開かない。
  await source.start()

  source.onAudioData((pcm) => {
    if (stopped) return
    chunks.push(pcm)
    total += pcm.length
    onChunk?.(total)
  })

  // 停止・終了・タブ離脱のいずれでも必ずマイクを閉じる（開きっぱなし防止・spec §4.4）。
  function onBeforeUnload() {
    void stop()
  }
  window.addEventListener('beforeunload', onBeforeUnload)

  // 30s 上限で自動停止を促す（実停止と WAV 化は呼び出し側が stop() で行う）。
  maxTimer = setTimeout(() => {
    onMaxDuration?.()
  }, maxMs)

  async function stop(): Promise<Float32Array> {
    if (!stopped) {
      stopped = true
      if (maxTimer) clearTimeout(maxTimer)
      window.removeEventListener('beforeunload', onBeforeUnload)
      // dispose() = stop()（audioControl(false)）+ listeners クリア。
      source.dispose()
    }
    return concatChunks(chunks)
  }

  return { stop }
}
