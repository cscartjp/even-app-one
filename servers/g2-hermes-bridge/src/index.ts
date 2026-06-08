// G2 Hermes Bridge Server — Phase 1 テキスト Bridge PoC のエントリポイント。
// 設定を読み、サーバーを組み立てて listen する。ルート定義は server.ts。
import { loadConfig } from './config'
import { buildServer } from './server'

const config = loadConfig()
const app = buildServer({ config })

// 0.0.0.0 で待ち受け、スマホから Tailscale IP 経由で到達可能にする。
app.listen({ host: '0.0.0.0', port: config.port }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
