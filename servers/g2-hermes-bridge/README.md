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

## 常時自動起動（launchd・Mac B）

構成 B-1（Bridge を Hermes と同一 Mac = Mac B に同居）での常時自動起動手順。Bridge は Hermes に依存するため、**Hermes gateway → Bridge の順**に登録する。どちらもユーザー LaunchAgent（`~/Library/LaunchAgents/`、sudo 不要）。

```bash
# 1. Hermes gateway を launchd サービス化（純正コマンド・冪等。--force で再インストール）
hermes gateway install
hermes gateway status          # "Gateway service is loaded" を確認

# 2. Bridge の plist を配置して登録
cp deploy/com.frogman.g2hermes-bridge.plist ~/Library/LaunchAgents/
pkill -f "bun src/index.ts" 2>/dev/null   # 手動 nohup 起動が残っていれば停止（ポート競合回避）
launchctl load -w ~/Library/LaunchAgents/com.frogman.g2hermes-bridge.plist

# 3. 確認
launchctl list | rg 'frogman|ai.hermes.gateway'
curl -s http://127.0.0.1:8787/health     # {"ok":true,...,"hermes":"reachable"}
```

[`deploy/com.frogman.g2hermes-bridge.plist`](deploy/com.frogman.g2hermes-bridge.plist) は `RunAtLoad`（ログイン時起動）+ `KeepAlive`（クラッシュ時自動復帰）。`WorkingDirectory` を Bridge ディレクトリに設定しているため Bun が `.env` を自動読込する。ログは `~/g2bridge.log` / `~/g2bridge.err`。

停止・解除は `launchctl unload -w ~/Library/LaunchAgents/com.frogman.g2hermes-bridge.plist`。

> **注意**: macOS のユーザー LaunchAgent は **GUI ログイン時**に起動する。Mac B が自動ログイン無効の場合、再起動後に GUI ログインするまで Bridge / Hermes は起動しない。完全無人で復帰させたい場合は Mac B 側で自動ログインを有効化する。

### 別の Mac で使う場合

plist は launchd の仕様上、絶対パスをハードコードしている（`~` / `$HOME` 展開不可）。**別ユーザー名・別パスの Mac に移す場合は、配置前に plist 内の次を書き換える**:

- `ProgramArguments` の `bun` 絶対パス（例 `/Users/yoshiura/.bun/bin/bun` → `which bun` の結果）
- `WorkingDirectory`（リポジトリの clone 先に合わせる）
- `EnvironmentVariables` の `PATH`（`bun` / Homebrew のパス）
- `StandardOutPath` / `StandardErrorPath`

同一ユーザー（`yoshiura`）・同一パス構成の Mac へ移す場合はそのまま `cp` で流用可。
