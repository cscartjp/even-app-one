// Mac Bridge Server（/v1/ask）クライアント。Bearer 認証 + AbortController タイムアウト。
// 秘密境界（仕様書 §11）: ここで使う VITE_BRIDGE_TOKEN は WebView 用の弱いトークン。
// Hermes の強いキー（HERMES_API_KEY）は Bridge 側に留まり WebView には出ない。

const BRIDGE_BASE = import.meta.env.VITE_BRIDGE_BASE ?? 'http://127.0.0.1:8787'
const BRIDGE_TOKEN = import.meta.env.VITE_BRIDGE_TOKEN ?? 'dev-token'

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
    const result = (await res.json()) as AskResult
    return { ok: true, result }
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
