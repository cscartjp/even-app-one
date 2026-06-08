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

/** クライアント側タイムアウト。Bridge 自身も Hermes へ別途タイムアウトを張る。 */
const TIMEOUT_MS = 20_000

/** `/v1/ask` の正常レスポンス（Bridge の AskResult と同形）。 */
export interface AskResult {
  ok: true
  sessionId: string
  responseId: string | null
  text: string
  pages: string[]
  audioUrl: null
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
): Promise<AskOutcome> {
  if (!BRIDGE_BASE || !BRIDGE_TOKEN) {
    return { ok: false, error: 'Bridge 未設定（.env を確認）' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BRIDGE_BASE}/v1/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${BRIDGE_TOKEN}`,
      },
      body: JSON.stringify({ sessionId, text, mode }),
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
 * Bridge 応答が AskResult の最低限の形か実行時に検証する（`as` の素通しを防ぐ）。
 * 利用側が触る `text` / `pages`（文字列配列）だけを必須にする。
 */
function isAskResult(v: unknown): v is AskResult {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.text === 'string' &&
    Array.isArray(o.pages) &&
    o.pages.every((p) => typeof p === 'string')
  )
}
