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
| `bun test` | ユニットテスト（pure 関数。Task 1.2 以降） |
| `bun run dev` | ローカル起動（Task 1.3 でルート実装後） |

## 環境変数（`env.example` 参照）

| 変数 | 用途 |
|------|------|
| `PORT` | Bridge の待ち受けポート（既定 8787） |
| `BRIDGE_TOKEN` | WebView → Bridge の Bearer 認証トークン |
| `HERMES_BASE_URL` | Hermes API Server のベース URL（`/v1` まで） |
| `HERMES_API_KEY` | Hermes の API キー。WebView には渡さない |
