/** Bridge Server のバージョン（/health で返す）。 */
export const VERSION = '0.1.0'

/** Bridge Server の実行時設定。 */
export interface BridgeConfig {
  /** Bridge の待ち受けポート。 */
  port: number
  /** WebView → Bridge の Bearer 認証トークン。 */
  bridgeToken: string
  /** Hermes API Server のベース URL（`/v1` まで）。 */
  hermesBaseUrl: string
  /** Hermes の API キー。WebView には渡さない。 */
  hermesApiKey: string
  /**
   * Bridge→Hermes ask fetch のタイムアウト（ms）。超過で 504。
   * Hermes エージェントは住所/評価などの lookup で生成が伸びるため長め（既定 180s。
   * 実測で住所＋評価つきの質問が ~115s かかった例があり、余裕を持たせている）。
   * グラス表示なので待てる前提。/health の到達性プローブには使わない（checkHermes は別の短い値）。
   */
  hermesTimeoutMs: number
  /**
   * CORS で許可する Origin。`true` は全 origin 反映（Phase 1 既定）。
   * 実 WebView の Origin を採取後（Task 1.5）に allowlist 化する（仕様書 §15.1）。
   */
  corsAllowedOrigins: true | string[]
  /** STT サイドカーのベース URL（loopback、`/transcribe` まで含めない）。 */
  sttBaseUrl: string
  /** Bridge→STT fetch のタイムアウト（ms）。STT は重いため Hermes より長め。超過で 504。 */
  sttTimeoutMs: number
  /** `/v1/transcribe` の WAV ボディ上限（bytes）。超過で 413。 */
  transcribeMaxBytes: number
  /** listen するホスト。既定 `0.0.0.0`。本番は Tailscale IF の IP を BIND_HOST で指定して締める（Phase 8）。 */
  bindHost: string
  /** AivisSpeech Engine のベース URL（VOICEVOX 互換・loopback）。 */
  aivisBaseUrl: string
  /** Aivis の話者 ID（既定 まお／ノーマル）。URL クエリに載せるため文字列で保持。 */
  aivisSpeakerId: string
  /** `/audio_query` の fetch タイムアウト（ms）。超過で型付きエラー→audioUrl:null 降格。 */
  aivisQueryTimeoutMs: number
  /** `/synthesis` の fetch タイムアウト（ms）。合成は重いため query より長め。 */
  aivisSynthesisTimeoutMs: number
  /** Aivis 合成フロー全体の abort タイムアウト（ms）。query+synthesis の総和上限。 */
  aivisAbortTimeoutMs: number
  /** TTS 対象テキストの最大文字数。超過は切り詰め（長文読み上げの WAV 肥大を避ける）。 */
  ttsMaxChars: number
  /** Aivis `/synthesis` の同時実行上限（重いため絞る）。 */
  ttsMaxConcurrency: number
  /** audio キャッシュの TTL（秒）。 */
  audioTtlSeconds: number
  /** audio キャッシュの最大件数（超過は古い順 evict）。 */
  audioMaxEntries: number
  /** audio キャッシュの総 byte 上限（超過は古い順 evict）。 */
  audioMaxBytes: number
}

/** 環境変数から設定を読む。未設定・不正値はローカル開発向けの既定値にフォールバックする。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  return {
    port: toPositiveInt(env.PORT, 8787),
    bridgeToken: env.BRIDGE_TOKEN ?? 'dev-token',
    hermesBaseUrl: env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642/v1',
    hermesApiKey: env.HERMES_API_KEY ?? 'change-me-local-dev',
    hermesTimeoutMs: toPositiveInt(env.HERMES_TIMEOUT_MS, 180000),
    corsAllowedOrigins: parseOrigins(env.CORS_ALLOWED_ORIGINS),
    sttBaseUrl: env.STT_BASE_URL ?? 'http://127.0.0.1:8643',
    sttTimeoutMs: toPositiveInt(env.STT_TIMEOUT_MS, 60000),
    transcribeMaxBytes: toPositiveInt(
      env.TRANSCRIBE_MAX_BYTES,
      2 * 1024 * 1024,
    ),
    bindHost: env.BIND_HOST ?? '0.0.0.0',
    aivisBaseUrl: env.AIVIS_BASE_URL ?? 'http://127.0.0.1:10101',
    aivisSpeakerId: env.AIVIS_SPEAKER_ID ?? '888753760',
    aivisQueryTimeoutMs: toPositiveInt(env.AIVIS_QUERY_TIMEOUT_MS, 5000),
    aivisSynthesisTimeoutMs: toPositiveInt(
      env.AIVIS_SYNTHESIS_TIMEOUT_MS,
      15000,
    ),
    aivisAbortTimeoutMs: toPositiveInt(env.AIVIS_ABORT_TIMEOUT_MS, 20000),
    ttsMaxChars: toPositiveInt(env.TTS_MAX_CHARS, 300),
    ttsMaxConcurrency: toPositiveInt(env.TTS_MAX_CONCURRENCY, 2),
    audioTtlSeconds: toPositiveInt(env.AUDIO_TTL_SECONDS, 300),
    audioMaxEntries: toPositiveInt(env.AUDIO_MAX_ENTRIES, 100),
    audioMaxBytes: toPositiveInt(env.AUDIO_MAX_BYTES, 209715200),
  }
}

/**
 * `CORS_ALLOWED_ORIGINS`（カンマ区切り）を allowlist に変換する。
 * 未設定・空なら `true`（全 origin 反映）。Phase 1 は実 WebView の Origin が
 * 未確定（仕様書のリスク3）なため既定で反映し、採取後に env で締める。
 */
function parseOrigins(value: string | undefined): true | string[] {
  if (!value) return true
  const list = value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return list.length > 0 ? list : true
}

/**
 * 正の有限整数として解釈できなければ fallback を返す。
 * `PORT=abc`（NaN）や空文字（0）で listen({ port: NaN }) や即時 abort を起こさないため。
 */
function toPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}
