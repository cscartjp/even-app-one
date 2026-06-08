// 音声キャプチャの純粋関数（PCM チャンク結合・WAV 化・空/極短ガード）。
// WAV エンコードは even-toolkit の `float32ToWav` を流用する（Task 3.3.1 で実体確認）。
// `even-toolkit/stt`（index）は import 時に `window` を参照し Node/bun で落ちるため、
// `window` 非依存の `even-toolkit/stt/audio`（pcm-utils）サブパスから直接取る。
// これにより本ファイルは WebView 非依存＝ bun でユニットテストできる。
import { float32ToWav } from 'even-toolkit/stt/audio'

/** G2 マイクの PCM サンプルレート（GlassBridgeSource は常に 16000Hz）。 */
export const SAMPLE_RATE = 16000

/** 最大録音時間。超過したら自動停止して文字起こしへ進む（spec §4.4 / D3）。 */
export const MAX_RECORDING_MS = 30_000

/** これ未満は誤タップ・無音とみなしクライアントで弾く閾値（spec §5）。 */
export const MIN_RECORDING_MS = 500

/** MIN_RECORDING_MS をサンプル数に換算した下限（500ms = 8000サンプル）。 */
const MIN_SAMPLES = (MIN_RECORDING_MS / 1000) * SAMPLE_RATE

/** Float32 チャンク列を順序を保って 1 本の Float32Array に結合する。 */
export function concatChunks(chunks: Float32Array[]): Float32Array {
  let total = 0
  for (const c of chunks) total += c.length
  const out = new Float32Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.length
  }
  return out
}

/** 空・極短録音（閾値未満）か。true なら文字起こしに送らず録り直しへ戻す。 */
export function isTooShort(samples: Float32Array): boolean {
  return samples.length < MIN_SAMPLES
}

/** Float32 サンプルを 16kHz/mono/16bit の WAV Blob にする（`Content-Type: audio/wav`）。 */
export function encodeWav(samples: Float32Array): Blob {
  return float32ToWav(samples, SAMPLE_RATE)
}
