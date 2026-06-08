# g2-hermes-bridge

Even G2 ↔ Hermes Agent の Mac 側 Bridge Server（Fastify + zod）。
G2 クライアント（`apps/g2hermes`）からのテキスト問い合わせを受け、Hermes Agent API Server
（`http://127.0.0.1:8642/v1/responses`）へ中継して短文化・ページングした回答を返す。

product contract（正本）: [`docs/spec/g2-hermes-bridge.md`](../../docs/spec/g2-hermes-bridge.md)

## セットアップ

```bash
cp env.example .env   # 実値を設定（.env は gitignore）
bun install           # 依存解決（リポジトリ root で実行）
```

> 環境変数テンプレートは `.env.example` ではなく **`env.example`**（先頭ドット無し）です。
> リポジトリの secret 保護ガードが `.env*` への書き込みを一律ブロックするため。中身・用途は同じです。

## スクリプト

| script | 内容 |
|--------|------|
| `bun run build` | `tsc` 型チェック |
| `bun run check` | `biome check`（lint + format） |
| `bun test` | ユニットテスト + ルートの inject 統合テスト |
| `bun run dev` | ローカル起動（`0.0.0.0:PORT` で listen） |

## ルート

| route | 認証 | 内容 |
|-------|------|------|
| `GET /health` | 不要 | `{ ok, version, hermes }`。`hermes` は到達性（reachable/unreachable/timeout/error:NNN） |
| `POST /v1/ask` | Bearer 必須 | `{ sessionId, text, mode? }` を Hermes へ中継し `{ ok, sessionId, responseId, text, pages, audioUrl }` を返す |
| `OPTIONS *` | 不要 | CORS preflight（@fastify/cors が応答。認証はスキップ） |

`POST /v1/ask` は zod 検証（不正は 400）、Bearer 認証（無効は 401）、`previous_response_id` による会話継続、Bridge→Hermes の `AbortController` タイムアウト（超過は 504、不達は 502）を行う。

## 環境変数（`env.example` 参照）

| 変数 | 用途 |
|------|------|
| `PORT` | Bridge の待ち受けポート（既定 8787） |
| `BRIDGE_TOKEN` | WebView → Bridge の Bearer 認証トークン |
| `HERMES_BASE_URL` | Hermes API Server のベース URL（`/v1` まで）。別 Mac の Hermes には SSH トンネルで 127.0.0.1 維持 or Tailscale IP 指定 |
| `HERMES_API_KEY` | Hermes の API キー。WebView には渡さない |
| `HERMES_TIMEOUT_MS` | Bridge→Hermes タイムアウト（ms・任意、既定 30000） |
