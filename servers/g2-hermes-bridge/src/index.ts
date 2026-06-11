// G2 Hermes Bridge Server — Phase 1 テキスト Bridge PoC のエントリポイント。
// 設定を読み、サーバーを組み立てて listen する。ルート定義は server.ts。
import { loadConfig } from './config'
import { buildServer } from './server'

const config = loadConfig()
const app = buildServer({ config })

// listen ホストは config.bindHost（既定 0.0.0.0）。スマホは Tailscale IP 経由で到達する。
// 多層防御（Phase 8・Codex P2）: bearerless の `/audio/<id>` を LAN 等の他インターフェースから
// 守るため、本番は `.env` の BIND_HOST に **Tailscale インターフェースの IP** を設定して
// その IF だけで待ち受ける（or OS firewall で他 IF からの :PORT を遮断する）。
// 256bit capability id があるため漏洩リスクは低いが、bind/firewall で面を狭める。
app.listen({ host: config.bindHost, port: config.port }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
