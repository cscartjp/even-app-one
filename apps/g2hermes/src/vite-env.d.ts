/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Mac Bridge Server のベース URL（例: http://100.x.x.x:8787）。 */
  readonly VITE_BRIDGE_BASE: string
  /** WebView 用の弱い Bearer トークン（Bridge の BRIDGE_TOKEN と一致）。 */
  readonly VITE_BRIDGE_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
