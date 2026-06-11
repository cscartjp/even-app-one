import type { BridgeConfig } from './config'

/** Bridge→Aivis 呼び出しの依存。`fetchImpl` 差し替えでテスト可能にする。 */
export interface AivisDeps {
  config: BridgeConfig
  fetchImpl?: typeof fetch
}

/** Aivis へ届かない / 非200 応答。呼び出し側で audioUrl:null に降格する。 */
export class AivisUnreachableError extends Error {}
/** タイムアウト超過。呼び出し側で audioUrl:null に降格する。 */
export class AivisTimeoutError extends Error {}

/**
 * AivisSpeech Engine（VOICEVOX 互換）でテキストを WAV に合成する。
 * フロー: `POST /audio_query?text=&speaker=`（query JSON 取得）→
 * `POST /synthesis?speaker=`（body=query JSON）→ WAV（44100/mono/16bit）。
 *
 * タイムアウトは 1 本の AbortController を共有し、全体（aivisAbortTimeoutMs）と
 * 各ステップ（query/synthesis）の両方で abort する。abort 由来は AivisTimeoutError、
 * 非200・fetch 失敗は AivisUnreachableError として型付きで返す（呼び出し側で null 降格）。
 */
export async function synthesizeWav(
  deps: AivisDeps,
  text: string,
): Promise<Buffer> {
  const { config } = deps
  const fetchImpl = deps.fetchImpl ?? fetch
  const base = config.aivisBaseUrl
  const speaker = encodeURIComponent(config.aivisSpeakerId)

  const controller = new AbortController()
  // 全体 abort（query+synthesis の総和上限）。ステップタイマーとは別に常に張る。
  const overall = setTimeout(
    () => controller.abort(),
    config.aivisAbortTimeoutMs,
  )
  try {
    // 1) audio_query: text と speaker を URL クエリで渡す（body 無し）。
    const queryUrl = `${base}/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`
    const queryJson = await step(
      () => fetchImpl(queryUrl, { method: 'POST', signal: controller.signal }),
      config.aivisQueryTimeoutMs,
      controller,
      async (res) => (await res.json()) as unknown,
    )

    // 2) synthesis: audio_query の JSON をそのまま body に載せ WAV を得る。
    const synthUrl = `${base}/synthesis?speaker=${speaker}`
    return await step(
      () =>
        fetchImpl(synthUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryJson),
          signal: controller.signal,
        }),
      config.aivisSynthesisTimeoutMs,
      controller,
      async (res) => Buffer.from(await res.arrayBuffer()),
    )
  } catch (err) {
    if (controller.signal.aborted) {
      throw new AivisTimeoutError(
        `Aivis timeout after ${config.aivisAbortTimeoutMs}ms`,
      )
    }
    if (err instanceof AivisUnreachableError) throw err
    throw new AivisUnreachableError(`Aivis fetch failed: ${errorMessage(err)}`)
  } finally {
    clearTimeout(overall)
  }
}

/**
 * 1 ステップ（fetch + body 読み取り）をステップ用タイムアウト付きで実行する。
 * タイマーは body 読み取り完了まで解除しない（fetch は headers 到着で解決するため、
 * 先に解除すると body が詰まったとき abort されず無限待ちになる。hermes-client と同じ理由）。
 */
async function step<T>(
  doFetch: () => Promise<Response>,
  timeoutMs: number,
  controller: AbortController,
  readBody: (res: Response) => Promise<T>,
): Promise<T> {
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await doFetch()
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new AivisUnreachableError(
        `Aivis ${res.status}: ${detail.slice(0, 200)}`,
      )
    }
    return await readBody(res)
  } finally {
    clearTimeout(timer)
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
