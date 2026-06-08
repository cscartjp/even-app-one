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
  /** Bridge→Hermes fetch のタイムアウト（ms）。超過で 504 を返す。 */
  hermesTimeoutMs: number
}

/** 環境変数から設定を読む。未設定はローカル開発向けの既定値にフォールバックする。 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  return {
    port: Number(env.PORT ?? 8787),
    bridgeToken: env.BRIDGE_TOKEN ?? 'dev-token',
    hermesBaseUrl: env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642/v1',
    hermesApiKey: env.HERMES_API_KEY ?? 'change-me-local-dev',
    hermesTimeoutMs: Number(env.HERMES_TIMEOUT_MS ?? 30000),
  }
}
