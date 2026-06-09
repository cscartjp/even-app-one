> **アーカイブ（2026-06-09）**: 本ファイルは G2 Hermes Bridge の **Phase 0（足場）と Phase 1（テキスト Bridge PoC）** の計画記録です。**全タスク完了済み**のためルート `Plans.md` から退避しました。アーキテクチャ・制約・リスク・進行中の Phase（2 / 3）はルート `Plans.md` を参照。product contract は `docs/spec/g2-hermes-bridge.md`。

# G2 Hermes Bridge — Phase 0 / Phase 1（完了・アーカイブ）

作成日: 2026-06-08 / アーカイブ日: 2026-06-09

---

## Phase 0: 足場（scaffold + baseline）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 0.1 | ルート `package.json` の `workspaces` を `["apps/*", "servers/*"]` に拡張し、`servers/` ディレクトリを用意 [tdd:skip:config-only] | `bun install` がエラー0で通り、`servers/*` が workspace として認識される。`apps/hisho` のビルド/型に影響なし（`apps/hisho` は読み取りのみ・改変禁止） | - | cc:完了 [288a5fc] |
| 0.2 | Bridge Server パッケージ雛形 `servers/g2-hermes-bridge`（Fastify + @fastify/cors + zod、TS、biome、`bun test` 前提。`env.example`（ドット無し: secret ガードが `.env*` 書き込みをブロックするため）に PORT/BRIDGE_TOKEN/HERMES_BASE_URL/HERMES_API_KEY） [tdd:skip:scaffold-only] | `bun run --filter g2-hermes-bridge build`（tsc）成功、`biome check` エラー0、`env.example` あり（実 `.env` は gitignore） | 0.1 | cc:完了 [58eba3f] |
| 0.3 | G2 クライアント雛形 `apps/g2hermes`（Vite+TS+React+even-toolkit、hisho の vite/biome/tsconfig を踏襲）+ `app.json`（package_id `com.frogman.g2hermes`、network whitelist のみ。**マイク権限は入れない**=Phase 1 はテキストのみ） [tdd:skip:scaffold-only] | `bun run --filter g2hermes build` 成功、`biome check` エラー0、`app.json` が evenhub-cli で valid | 0.1 | cc:完了 [b4801b6] |

## Phase 1: テキスト Bridge PoC

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | Hermes API Server 有効化 + 契約 smoke（コードではなく手順 + 確認）。`~/.hermes/.env` に `API_SERVER_ENABLED=true` / `API_SERVER_KEY=<実値>`、`hermes gateway` 起動、`curl /v1/responses` で応答取得 [tdd:skip:external-setup] | `curl http://127.0.0.1:8642/v1/responses`（Bearer 付き）が 200 で `output[].content[].type==='output_text'` を含む。`function_call` 混入応答でも本文が取れることを1回確認。`previous_response_id` で2ターン会話継続を確認。`API_SERVER_KEY` は `change-me-local-dev` のままにしない | 0.2 | cc:完了（2026-06-08 live: Mac B で `hermes gateway` 稼働・`/v1/responses` 200・実応答が `function_call`+`function_call_output`+`message` 混在でも `output_text` 抽出・`previous_response_id` で2ターン継続・`API_SERVER_KEY` は実値で Bridge `.env` と SHA256 一致） |
| 1.2 | Bridge ピュア関数を **TDD** で実装: `extractOutputText`（`message`/`output_text` 抽出・`function_call` スキップ）/ `paginateForG2`（90字・空白正規化）/ 日本語を含む長文の分割 [tdd:required] | `bun test` グリーン。`function_call`+`message` 混在の実レスポンス JSON フィクスチャで本文のみ抽出。日本語90字超が複数ページに分割され各ページ ≤90字 | 0.2 | cc:完了 [dd00ecb] |
| 1.3 | Bridge ルート実装: `GET /health`（自身 + Hermes 到達性 `checkHermes`）/ `POST /v1/ask`（zod 検証・`Bearer` 認証・`previous_response_id` セッション・short instructions）。**CORS は OPTIONS と /health を認証スキップ**し preflight を壊さない。`origin` をログ採取。Bridge→Hermes に `AbortController` タイムアウト [tdd:skip:integration-curl] | `curl` で: トークン無 `/v1/ask` が 401 / 正規トークンで 200 + `pages` 返却 / `OPTIONS /v1/ask`（Origin+Access-Control-Request-* 付き）が 200/204 で CORS ヘッダ付与 / Hermes 停止時に分かるエラー / タイムアウト超過で 504 系。`biome check` 0、`bun run build` 成功 | 1.1, 1.2 | cc:完了 [a403f6b]（route 挙動は inject 統合テスト20本で検証。実 Hermes 相手の live curl は 2026-06-08 に B-1 同居構成で確認済み: `/health`→`hermes:"reachable"`・`/v1/ask` 200+`pages`・トークン無401・OPTIONS preflight 204+CORS・sessionId で会話継続） |
| 1.4 | G2 クライアント実装（even-toolkit）: `api/bridgeClient.ts`（`/v1/ask` fetch・Bearer・`AbortController` タイムアウト）+ Ask/Next/Exit メニュー画面（`GlassScreen` の display/action）+ App で Hermes 呼び出しを **React state 経由**（idle→Thinking→回答ページ）に配線。Next でページ送り、ダブルタップで戻る/終了 [tdd:skip:integration-simulator] | `bun run build` 成功・`biome check` 0。シミュレーターで Ask→"Thinking…"→回答表示、↕でメニュー移動、Next で次ページ、ダブルタップで戻る、を確認 | 0.3, 1.3 | cc:完了（`bun run build` 成功・`biome check` 0・Codex/CodeRabbit/Copilot レビュー対応（PR #22）。**Ask 入力はグラスでプリセット質問を↕選択して送信**（キーボード無し・ユーザー選択。スマホ入力は §18 step2 で前倒し可）。単一画面 + React state（idle/thinking/answer/error）、`shutdownOnHomeBack:false` で GO_BACK 自前処理（answer→idle 戻る / idle→終了 `shutDownPageContainer(1)`）。**evenhub-simulator で検証済み（2026-06-08, automation API）**: idle メニュー4問描画・↕でハイライト移動・タップ送信→`Thinking…`→**実 Hermes 回答**（Mac B Bridge 経由の E2E、例「今日は2026年6月8日(月)です」）・ダブルタップで質問選択へ戻る・console エラー0。実機グラス最終確認は 1.5 で実施） |
| 1.5 | エンドツーエンド検証 + v0.1.0 パッケージング。実機 WebView の `Origin` 実値を採取し CORS 方針を確定、preflight 通過・タイムアウト挙動・会話継続・秘密境界（Hermes Key が WebView/通信に出ない）を確認。app.json whitelist は **Tailscale IP の full origin（`http://100.x.x.x:PORT`）のみ**記載（LAN IP は使わない）、`bun run build` + `evenhub pack` で `.ehpk` 生成 [tdd:skip:integration-e2e] | Hub In-Development or sideload 経由で G2 に Hermes 回答が表示される。`req.headers.origin` 実値を計画ノートに記録。`g2hermes.ehpk` 生成。実機最終確認はユーザー実施 | 1.4 | cc:完了（2026-06-08 実機 E2E 達成: `bunx evenhub pack app.json dist -o g2hermes.ehpk`（v0.1.0）で生成し**実機 G2 で Hermes 回答表示成功**。`req.headers.origin` 実値=**`http://127.0.0.1:<ランダムポート>`**（Even Hub WebView がパッケージアプリをローカル配信・ポート毎回変動。シミュレーター=`http://localhost:5174`、curl=`null`）。**→ 実機 Origin は HTTP なので mixed-content 不発・HTTPS 化不要**（PR #21 の懸念解消）。CORS は Phase 1 トークンゲート済みで reflect-all 維持（締めるならポート固定不可のため `http://127.0.0.1`/`http://localhost` ワイルドカード）。`.ehpk`/`dist` は gitignore・実 IP/トークンは bundle へローカル焼き込みのみ） |

### スコープ外（Phase 1 に含めない）

- G2 マイク入力 / PCM 取得 / STT（仕様書 §13 Phase 3・§9.1）
- TTS（Mac `say` / 音声ファイル再生。仕様書 §13 Phase 4・§9.2）
- 常用化: Cloudflare Tunnel 固定ドメイン / HTTPS / JWT / rate limit（仕様書 §13 Phase 5・§10.2）
- WebSocket 音声ストリーミング（仕様書 §5.3）

### 検証メモ（Phase 1 で採取・確定）

- [x] 実機 WebView の `Origin` 実値（2026-06-08 採取・Mac B Bridge ログ）: **`http://127.0.0.1:<ランダムポート>`**（実機 G2 / Even Hub WebView がパッケージアプリをローカル配信。ポートは起動毎に変動）。シミュレーター=`http://localhost:5174`、curl/一部 GET=`null`。**mixed-content 解消**: 実機 Origin が `http://` のため `http://` Bridge への fetch は同スキームで通り、HTTPS 化（Tailscale Serve 等）は Phase 1 では不要だった（PR #21 の懸念は不発）。CORS allowlist を締める場合はポート固定不可のため `http://127.0.0.1`/`http://localhost` のポートワイルドカード方針。
- [x] Mac B（Hermes 同居機）の Tailscale IP（whitelist 用）: 確定済み。**実値は公開 repo に書かずローカルにのみ保持**し、`app.json` は placeholder（`100.64.0.1`）を commit、`evenhub pack` 前にローカルで実 IP へ置換（B-1）
- [x] Hermes 応答の実レイテンシ: Phase 1 で 1ターン数秒〜（ツール実行時はさらに長い）を確認。詳細レイテンシ P50/P95 は Phase 3.5.1 で計測予定
