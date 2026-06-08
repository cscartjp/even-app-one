import type { BridgeConfig } from './config'

/** Bridge→STT サイドカー呼び出しの依存。`fetchImpl` 差し替えでテスト可能にする。 */
export interface SttDeps {
  config: BridgeConfig
  fetchImpl?: typeof fetch
}

/** `/v1/transcribe` のレスポンス本体。 */
export interface TranscribeResult {
  ok: true
  text: string
  ms: number
}

/** サイドカーへ届かない / エラー応答。呼び出し側で 502 にマップする。 */
export class SttUnreachableError extends Error {}
/** タイムアウト超過。呼び出し側で 504 にマップする。 */
export class SttTimeoutError extends Error {}

/**
 * STT サイドカー `127.0.0.1:8643/transcribe` に WAV を送り、文字起こし結果を返す。
 * `AbortController` でタイムアウトする。タイマーは body 読み取り完了まで解除しない
 * （hermes-client と同じ理由: fetch は headers 到着で解決するため）。
 */
export async function transcribeAudio(
  deps: SttDeps,
  wav: Buffer,
): Promise<TranscribeResult> {
  const { config } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.sttTimeoutMs)
  try {
    const res = await fetchImpl(`${config.sttBaseUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/wav' },
      body: wav,
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new SttUnreachableError(
        `STT sidecar ${res.status}: ${detail.slice(0, 200)}`,
      )
    }

    const json = (await res.json()) as { text?: string; ms?: number }
    return { ok: true, text: json.text ?? '', ms: json.ms ?? 0 }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new SttTimeoutError(`STT timeout after ${config.sttTimeoutMs}ms`)
    }
    if (err instanceof SttUnreachableError) throw err
    throw new SttUnreachableError(`STT fetch failed: ${errorMessage(err)}`)
  } finally {
    clearTimeout(timer)
  }
}

/** STT サイドカーの到達性を確認する（/health 用）。例外を投げず文字列で状態を返す。 */
export async function checkStt(
  deps: SttDeps,
): Promise<'reachable' | 'unreachable' | 'timeout' | `error:${number}`> {
  const { config } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.sttTimeoutMs)
  try {
    const res = await fetchImpl(`${config.sttBaseUrl}/health`, {
      signal: controller.signal,
    })
    return res.ok ? 'reachable' : `error:${res.status}`
  } catch {
    return controller.signal.aborted ? 'timeout' : 'unreachable'
  } finally {
    clearTimeout(timer)
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
