import type { BridgeConfig } from './config'
import { extractOutputText, type HermesResponse } from './extract-output-text'
import { paginateForG2 } from './paginate'

/** sessionId ごとに直近の Hermes response id を保持する（会話継続用、PoC はインメモリ）。 */
export type SessionStore = Map<string, { previousResponseId?: string }>

/** Bridge→Hermes 呼び出しの依存。`fetchImpl` 差し替えでテスト可能にする。 */
export interface HermesDeps {
  config: BridgeConfig
  sessions: SessionStore
  fetchImpl?: typeof fetch
}

/** `/v1/ask` のレスポンス本体。 */
export interface AskResult {
  ok: true
  sessionId: string
  responseId: string | null
  text: string
  pages: string[]
  audioUrl: null
}

/** Hermes へ届かない / エラー応答。呼び出し側で 502 にマップする。 */
export class HermesUnreachableError extends Error {}
/** タイムアウト超過。呼び出し側で 504 にマップする。 */
export class HermesTimeoutError extends Error {}

const SHORT_INSTRUCTIONS =
  'G2スマートグラスに表示するため、80字以内を基本に短く日本語で答えて。必要なら箇条書き最大3つ。'

/**
 * /health の Hermes 到達性プローブのタイムアウト上限（ms）。
 * ask 用の hermesTimeoutMs（長め）とは分離し、`min(hermesTimeoutMs, この値)` で打ち切る。
 * 長い ask timeout に引きずられて Hermes 停止時に /health がハングするのを防ぐ。
 * hermesTimeoutMs がこれより短い設定（テスト等）はその短い値を尊重する。
 */
const HEALTH_PROBE_TIMEOUT_MS = 5_000

/**
 * Hermes `/v1/responses` にテキストを送り、本文抽出 + G2 用ページ分割した結果を返す。
 * `previous_response_id` で会話を継続し、`AbortController` でタイムアウトする。
 */
export async function askHermes(
  deps: HermesDeps,
  sessionId: string,
  text: string,
  mode: 'short' | 'normal',
): Promise<AskResult> {
  const { config, sessions } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const previousResponseId = sessions.get(sessionId)?.previousResponseId

  const input =
    mode === 'short' ? `${SHORT_INSTRUCTIONS}\n\nUser: ${text}` : text
  const payload: Record<string, unknown> = {
    model: 'hermes-agent',
    input,
    store: true,
  }
  if (previousResponseId) payload.previous_response_id = previousResponseId

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.hermesTimeoutMs)
  // タイマーは body 読み取り完了まで解除しない。fetch は headers 到着で解決するため、
  // ここで先に clearTimeout すると、headers 後に body が詰まるケース（chunked/streaming や
  // ネットワーク不調）で res.json()/res.text() が abort されず無限待ちになる。
  try {
    const res = await fetchImpl(`${config.hermesBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.hermesApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new HermesUnreachableError(
        `Hermes API ${res.status}: ${detail.slice(0, 200)}`,
      )
    }

    const json = (await res.json()) as HermesResponse & { id?: string }
    const answerText = extractOutputText(json) || '返答を取得できませんでした'
    const responseId = json.id ?? null
    if (responseId) sessions.set(sessionId, { previousResponseId: responseId })

    return {
      ok: true,
      sessionId,
      responseId,
      text: answerText,
      pages: paginateForG2(answerText),
      audioUrl: null,
    }
  } catch (err) {
    if (controller.signal.aborted) {
      throw new HermesTimeoutError(
        `Hermes timeout after ${config.hermesTimeoutMs}ms`,
      )
    }
    if (err instanceof HermesUnreachableError) throw err
    throw new HermesUnreachableError(
      `Hermes fetch failed: ${errorMessage(err)}`,
    )
  } finally {
    clearTimeout(timer)
  }
}

/** Hermes の到達性を確認する（/health 用）。例外を投げず文字列で状態を返す。 */
export async function checkHermes(
  deps: Pick<HermesDeps, 'config' | 'fetchImpl'>,
): Promise<'reachable' | 'unreachable' | 'timeout' | `error:${number}`> {
  const { config } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const controller = new AbortController()
  // 到達性プローブは ask 用 hermesTimeoutMs（長め）と分離し、min(hermesTimeoutMs, 上限) で
  // 短く打ち切る（長くすると Hermes 停止時に /health 自体が長時間ハングするため）。
  const probeTimeoutMs = Math.min(
    config.hermesTimeoutMs,
    HEALTH_PROBE_TIMEOUT_MS,
  )
  const timer = setTimeout(() => controller.abort(), probeTimeoutMs)
  try {
    const res = await fetchImpl(`${config.hermesBaseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.hermesApiKey}` },
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
