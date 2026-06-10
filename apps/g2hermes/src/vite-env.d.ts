/// <reference types="vite/client" />

/** vite.config.ts の define で app.json の version が build 時に注入される。 */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  /** Mac Bridge Server のベース URL（例: http://100.x.x.x:8787）。 */
  readonly VITE_BRIDGE_BASE: string
  /** WebView 用の弱い Bearer トークン（Bridge の BRIDGE_TOKEN と一致）。 */
  readonly VITE_BRIDGE_TOKEN: string
  /**
   * TTS 実機プローブの gate（Phase 7）。既定 OFF（未設定で falsy）。
   * プローブ用 `.ehpk` のみ `VITE_TTS_PROBE=1` でビルドして ON にする。
   */
  readonly VITE_TTS_PROBE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
