// TTS 実機プローブ（Phase 7 / spec: docs/spec/g2-hermes-tts-probe.md）。
// 回答テキストの音声読み上げ（方式1 Web Speech API / 方式2-3 の `new Audio()`）が
// 実機 WebView（iOS=WKWebView）で鳴るかを観測するための最小機構。
//
// ファイル前半はピュア（window 非依存）で `ttsProbe.test.ts` のユニットテスト対象。
// 後半は副作用ランナー（device-io）。window グローバルは関数本体内でのみ参照するため、
// 本ファイルの import 自体に副作用は無い（bun test で安全に読める）。
import { BEEP_DATA_URI } from './beep'

// ---- ピュアコア（7.1・unit-tested） --------------------------------------

/** `speechSynthesis.getVoices()` の最小形。整形では `lang` だけ見る。 */
export interface VoiceLike {
  lang: string
}

/** capability 観測の整形結果（グラス verdict と console 出力の素材）。 */
export interface Capability {
  hasSpeechSynthesis: boolean
  voiceCount: number
  hasJa: boolean
}

/** 1 回の発話試行の結果（グラス1行整形の素材）。 */
export interface Verdict {
  /** speechSynthesis が在り `speak()` を例外なく発火できたか。 */
  spk: boolean
  /** `new Audio().play()` を例外なく発火できたか。 */
  aud: boolean
  voiceCount: number
}

/** 自動発話（回答後）か、ジェスチャ発話（タップ起点）か。console ラベルに使う。 */
export type ProbePhase = 'auto' | 'gesture'

/**
 * capability を整形する純関数。実 `window` 依存を避けるため、`speechSynthesis` の
 * 存在フラグと `getVoices()` の結果配列を引数で受ける。
 */
export function summarizeCapability(
  hasSpeechSynthesis: boolean,
  voices: readonly VoiceLike[],
): Capability {
  return {
    hasSpeechSynthesis,
    voiceCount: voices.length,
    hasJa: voices.some((v) => v.lang.toLowerCase().startsWith('ja')),
  }
}

/** verdict をグラス追記用の 1 行に整形する純関数（例 `🔊spk=Y aud=N v=3`）。 */
export function formatVerdictLine(verdict: Verdict): string {
  const yn = (b: boolean) => (b ? 'Y' : 'N')
  return `🔊spk=${yn(verdict.spk)} aud=${yn(verdict.aud)} v=${verdict.voiceCount}`
}

/**
 * gate 判定の純関数。`VITE_TTS_PROBE === '1'` のときだけ ON。未設定・`'0'`・`'false'`
 * など「ON のつもりでない値」はすべて OFF（spec の `=1` 起動と厳密一致）。
 * env 値を引数で受け、`import.meta.env` への依存を呼び出し側に寄せる。
 */
export function isProbeEnabled(flag: string | undefined): boolean {
  return flag === '1'
}

// ---- 副作用ランナー（7.3・device-io / OFF 時は呼ばれない） ----------------

/** 実 `window` から capability を読む。getVoices() は今ある分を読む（settle は別途 log）。 */
function detectCapability(): Capability {
  const hasSpeechSynthesis =
    typeof window !== 'undefined' && 'speechSynthesis' in window
  const voices = hasSpeechSynthesis ? window.speechSynthesis.getVoices() : []
  return summarizeCapability(hasSpeechSynthesis, voices)
}

/**
 * iOS では `getVoices()` が初回は空で `voiceschanged` 後に埋まる版がある。
 * 遅れて届いた音声一覧を console に 1 度だけ出して capability 観測を補う。
 */
function logLateVoices(phase: ProbePhase): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  const handler = () => {
    console.info(
      `[tts-probe] ${phase} voiceschanged`,
      summarizeCapability(true, synth.getVoices()),
    )
    synth.removeEventListener('voiceschanged', handler)
  }
  synth.addEventListener('voiceschanged', handler)
}

/** 方式1: `SpeechSynthesisUtterance`(ja-JP) を speak。発火できたら true。 */
function speakProbe(text: string, phase: ProbePhase): boolean {
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ja-JP'
    u.onstart = () => console.info(`[tts-probe] ${phase} speak: started`)
    u.onend = () => console.info(`[tts-probe] ${phase} speak: ended`)
    u.onerror = (e) =>
      console.warn(`[tts-probe] ${phase} speak: error`, e.error)
    window.speechSynthesis.speak(u)
    return true
  } catch (e) {
    console.warn(`[tts-probe] ${phase} speak: threw`, e)
    return false
  }
}

/** 方式2-3 共通: data-URI 極短ビープを `new Audio().play()`。発火できたら true。 */
function audioProbe(phase: ProbePhase): boolean {
  try {
    const audio = new Audio(BEEP_DATA_URI)
    void audio
      .play()
      .then(() => console.info(`[tts-probe] ${phase} audio: resolved`))
      .catch((e) => console.warn(`[tts-probe] ${phase} audio: rejected`, e))
    return true
  } catch (e) {
    console.warn(`[tts-probe] ${phase} audio: threw`, e)
    return false
  }
}

/** capability を読み、speechSynthesis と Audio の両経路を試して verdict を返す。 */
function runProbe(text: string, phase: ProbePhase): Verdict {
  const cap = detectCapability()
  console.info(`[tts-probe] ${phase} capability`, cap)
  logLateVoices(phase)
  const spk = cap.hasSpeechSynthesis ? speakProbe(text, phase) : false
  const aud = audioProbe(phase)
  return { spk, aud, voiceCount: cap.voiceCount }
}

/**
 * 自動発話フック（`ask.ts` の `ANSWERED` 直前で呼ぶ）。プローブ ON のときだけ
 * 両経路を発火し、グラス追記用の verdict 1 行を返す。OFF（既定）のとき null を返し、
 * `ask.ts` の挙動を完全 no-op に保つ。env gate と発火を 1 関数に閉じる。
 */
export function autoProbeLine(text: string): string | null {
  if (!isProbeEnabled(import.meta.env.VITE_TTS_PROBE)) return null
  return formatVerdictLine(runProbe(text, 'auto'))
}

/**
 * ジェスチャ発話（グラス CLICK / 送信タップ起点で呼ぶ）。ユーザー操作の呼び出しスタック内で
 * speak/play を発火し、user activation 制約と自動発話の差を弁別する。verdict は console に出す
 * （グラスへの追記は自動発話側だけが担う）。呼び出し側で env gate 済みの前提。
 */
export function runGestureProbe(text: string): void {
  const verdict = runProbe(text, 'gesture')
  console.info(`[tts-probe] gesture verdict`, formatVerdictLine(verdict))
}
