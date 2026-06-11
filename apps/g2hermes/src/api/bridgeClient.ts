// Mac Bridge Server（/v1/ask）クライアント。Bearer 認証 + AbortController タイムアウト。
// 秘密境界（仕様書 §11）: ここで使う VITE_BRIDGE_TOKEN は WebView 用の弱いトークン。
// Hermes の強いキー（HERMES_API_KEY）は Bridge 側に留まり WebView には出ない。

// 設定は配布時に必ず注入する（vite が `.env` を読み込む）。未設定のまま
// `127.0.0.1` 等へフォールバックすると、G2 WebView から見た `127.0.0.1` は
// Mac ではなく端末自身を指すため Ask が常に失敗する。よって壊れた既定値は置かず、
// 未設定は askBridge が明示エラーとして返す（黙って壊さない / 仕様書 §15.2）。
const BRIDGE_BASE = import.meta.env.VITE_BRIDGE_BASE
const BRIDGE_TOKEN = import.meta.env.VITE_BRIDGE_TOKEN

if (!BRIDGE_BASE || !BRIDGE_TOKEN) {
  console.warn(
    '[g2hermes] VITE_BRIDGE_BASE / VITE_BRIDGE_TOKEN が未設定です。apps/g2hermes/.env を確認してください（evenhub pack 前に必須）。',
  )
}

/**
 * ask のクライアント側タイムアウト。Bridge→Hermes（既定 180s）より長くし、Hermes が
 * 遅い（住所/評価などの lookup で生成が伸びる・実測 ~115s 例あり）ときに client が先に abort して
 * 「タイムアウト」を出すのを防ぐ。client が長いと Bridge の 504/エラーを受け取れる。グラスは待てる前提。
 */
const TIMEOUT_MS = 190_000

/**
 * TTS 要求（tts:true）時のクライアント側タイムアウト。Bridge は Hermes（最大 180s）に加えて
 * Aivis 合成（全体 abort 既定 20s）＋ 同時実行リミッタ待ちを要し得るため、190s だと Hermes が
 * 遅いケースで client が先に abort してしまう（Codex P2）。Aivis 分の余裕を上乗せする。
 */
const TTS_TIMEOUT_MS = 220_000

/**
 * 文字起こしのクライアント側タイムアウト。Bridge→STT は既定 60s なので、
 * それを上回る値にして「Bridge は待っているのに client が先に切れる」を防ぐ（spec §4.2）。
 */
const TRANSCRIBE_TIMEOUT_MS = 70_000

/** `/v1/ask` の正常レスポンス（Bridge の AskResult と同形）。 */
export interface AskResult {
  ok: true
  sessionId: string
  responseId: string | null
  text: string
  pages: string[]
  /** 読み上げ用の短縮文（tts:true 時のみ付く・Phase 8）。 */
  speechText?: string
  /** 合成成功時のみ相対 URL（/audio/<id>）、それ以外は null。 */
  audioUrl: string | null
}

/** 呼び出し結果。失敗はグラスに出す短いメッセージへ畳む（throw しない）。 */
export type AskOutcome =
  | { ok: true; result: AskResult }
  | { ok: false; error: string }

/**
 * Bridge の `/v1/ask` にテキストを送り、整形済み回答（pages 付き）を受け取る。
 * 同一 sessionId を使い続けると Bridge 側で会話が継続する（previous_response_id）。
 */
export async function askBridge(
  sessionId: string,
  text: string,
  mode: 'short' | 'normal' = 'short',
  tts = false,
): Promise<AskOutcome> {
  if (!BRIDGE_BASE || !BRIDGE_TOKEN) {
    return { ok: false, error: 'Bridge 未設定（.env を確認）' }
  }
  const controller = new AbortController()
  // tts:true は Aivis 合成分サーバ処理が伸びるため長めの上限を使う。
  const timer = setTimeout(
    () => controller.abort(),
    tts ? TTS_TIMEOUT_MS : TIMEOUT_MS,
  )
  try {
    const res = await fetch(`${BRIDGE_BASE}/v1/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BRIDGE_TOKEN}`,
      },
      // tts は ON のときだけ付ける（OFF/未設定は付けず現行リクエストとバイト等価）。
      body: JSON.stringify({
        sessionId,
        text,
        mode,
        ...(tts ? { tts: true } : {}),
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, error: `Bridge エラー (${res.status})` }
    }
    // body 読み取りは outer try に置く（タイムアウトで abort された場合は下の catch で
    // 「タイムアウト」になる）。JSON 解析と形検証は分けて原因を切り分ける。
    const body = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return { ok: false, error: '応答の解析に失敗' }
    }
    if (!isAskResult(parsed)) {
      return { ok: false, error: '応答が不正な形式' }
    }
    return { ok: true, result: parsed }
  } catch {
    // abort 由来はタイムアウト、それ以外は到達不能（CORS/whitelist/未起動）
    return {
      ok: false,
      error: controller.signal.aborted ? 'タイムアウト' : '接続できません',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Bridge 応答が AskResult の形か実行時に検証する（`as` の素通しを防ぐ）。
 * `text` / `pages` に加え、Phase 8 で使う `audioUrl`（string|null・必須）と
 * `speechText`（string|undefined・任意）も宣言と一致させて検証する（CodeRabbit 指摘）。
 */
export function isAskResult(v: unknown): v is AskResult {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.text === 'string' &&
    Array.isArray(o.pages) &&
    o.pages.every((p) => typeof p === 'string') &&
    (typeof o.audioUrl === 'string' || o.audioUrl === null) &&
    (o.speechText === undefined || typeof o.speechText === 'string')
  )
}

/** `/v1/transcribe` の正常レスポンス（Bridge の TranscribeResult と同形）。 */
export interface TranscribeResult {
  ok: true
  text: string
  ms: number
}

/** 文字起こしの結果。失敗はグラスに出す短いメッセージへ畳む（throw しない）。 */
export type TranscribeOutcome =
  | { ok: true; result: TranscribeResult }
  | { ok: false; error: string }

/**
 * 録音 WAV（audio/wav Blob）を Bridge の `/v1/transcribe` に送り、文字起こし結果を受け取る。
 * Blob 自体に `audio/wav` type が付くが、spec §9.1 に従いヘッダでも明示する。
 * askBridge と同じく失敗は throw せず短いメッセージへ畳む。
 */
export async function transcribe(wav: Blob): Promise<TranscribeOutcome> {
  if (!BRIDGE_BASE || !BRIDGE_TOKEN) {
    return { ok: false, error: 'Bridge 未設定（.env を確認）' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS)
  try {
    const res = await fetch(`${BRIDGE_BASE}/v1/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/wav',
        Authorization: `Bearer ${BRIDGE_TOKEN}`,
      },
      body: wav,
      signal: controller.signal,
    })
    if (!res.ok) {
      return { ok: false, error: `文字起こしエラー (${res.status})` }
    }
    const body = await res.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return { ok: false, error: '応答の解析に失敗' }
    }
    if (!isTranscribeResult(parsed)) {
      return { ok: false, error: '応答が不正な形式' }
    }
    return { ok: true, result: parsed }
  } catch {
    return {
      ok: false,
      error: controller.signal.aborted ? 'タイムアウト' : '接続できません',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Bridge 応答が TranscribeResult の形か検証する。`ok===true` まで見て、200 でも
 * `ok:false` のエラー形を成功扱いしないようにする（CodeRabbit 指摘・契約に整合）。
 */
function isTranscribeResult(v: unknown): v is TranscribeResult {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return o.ok === true && typeof o.text === 'string' && typeof o.ms === 'number'
}

/**
 * 回答音声（相対 audioUrl）をスマホスピーカーで再生する（Phase 8・device-io）。
 * `new Audio(<BRIDGE_BASE>+audioUrl).play()`。Phase 7 プローブで Android 前面・背面とも
 * 再生可と実機確認済み。play() の reject（自動再生制約・404 等）は握り潰してログのみ出し、
 * グラスの回答表示は阻害しない（404 は TTL 失効などの正常系）。
 */
export function playAudio(audioUrl: string): void {
  if (!BRIDGE_BASE) return
  try {
    const audio = new Audio(`${BRIDGE_BASE}${audioUrl}`)
    void audio.play().catch((e) => {
      console.warn('[g2hermes] 音声再生に失敗（無視して継続）', e)
    })
  } catch (e) {
    console.warn('[g2hermes] 音声再生の初期化に失敗（無視して継続）', e)
  }
}
