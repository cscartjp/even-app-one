# G2 Hermes Bridge v0.1.0 Plans.md

作成日: 2026-06-08

新規アプリ。Even G2 から Mac 上の Hermes Agent へ **テキストで問い合わせ → G2 に回答表示** する薄いブリッジ（Phase 1 テキスト PoC）。
音声 / STT / TTS / 常用化（Tunnel・HTTPS・JWT）は本計画のスコープ外（仕様書 §13 の Phase 2 以降）。

- **product contract（正本）**: `docs/spec/g2-hermes-bridge.md`（デスクトップ仕様書を 2026-06-08 にリポジトリへ取り込み。Phase 1 はこの §1〜§8・§11・§13 Phase 1・§16 を正解条件とする）
- **precedence**: `docs/spec/g2-hermes-bridge.md` > 本 `Plans.md`
- **Spec delta（2026-06-08）**: リポジトリに root `spec.md` は無いため、新アプリの product contract を `docs/spec/g2-hermes-bridge.md` として新設（=デスクトップ仕様書の取り込み）。Phase 1 では仕様書サンプルの **生 SDK 記述を even-toolkit API へ読み替える**点を本計画で上書き定義する（下記「設計上の正本差分」）。
- **team_validation_mode**: `subagent`（2026-06-08 に Explore で even-toolkit API、general-purpose で Hermes/CORS/セキュリティを一次情報照合済み。結論: 実現可能・要注意点3件を DoD 化）

> 関連: 過去の経緯は memory `hisho-train-app-design` / `g2-sideload-workflow` / `reference_hub_dev_mode`。完了済み Hisho 計画は `docs/plans/hisho-v0.1.4-v0.1.7.md`。

---

## アーキテクチャ（確定）

```text
Even G2 glasses
  ↑↓ Bluetooth
Even Realities App on phone WebView ── apps/g2hermes（薄い G2 クライアント・even-toolkit）
  ↑↓ HTTP over Tailscale (Phase 1)  ※app.json whitelist + サーバー側 CORS の両方が必要
Mac Bridge Server ── servers/g2-hermes-bridge（Node + Fastify + zod）
  └─ POST http://127.0.0.1:8642/v1/responses
Hermes Agent API Server（`hermes gateway`）
```

- **モノレポ構成**: ルート `package.json` の `workspaces` を `apps/*` → `["apps/*", "servers/*"]` に拡張。
- **G2 クライアント**: 既存 `apps/hisho` と同じ **even-toolkit + Vite + TS + React** で統一（生 SDK は使わない）。
- **秘密情報の境界**: Hermes API Key は Mac の `.env` のみ。WebView には Bridge Token（弱い秘密・ビルドに焼き込まれる前提）だけを渡す。

### 設計上の正本差分（仕様書 §7 サンプルからの読み替え）

仕様書 §7 のサンプルは生 SDK（`createStartUpPageContainer` / `textContainerUpgrade` をイベントハンドラ内で直叩き）だが、本アプリは hisho と同じ宣言的 even-toolkit で実装する。検証済みの読み替え:

| 仕様書サンプル（生SDK） | 本アプリ（even-toolkit）| 根拠 |
|---|---|---|
| `createStartUpPageContainer` / list+text コンテナ | `createGlassScreenRouter` の `GlassScreen = { display(snapshot,nav): DisplayData, action(...): GlassNavState }` | hisho `selectors.ts` / `screens/home.ts` |
| listEvent / currentSelectItemName | `GlassAction`: `SELECT_HIGHLIGHTED`(タップ) / `HIGHLIGHT_MOVE`(↕) / `GO_BACK`(ダブルタップ)、選択は `nav.highlightedIndex`（toolkit 管理） | even-toolkit `action-map.ts` / `glass-nav.ts` |
| ハンドラ内 `fetch` → `textContainerUpgrade` 直叩き | **fetch は React state 経由**。`useGlasses` が getSnapshot を 100ms ポーリング → state 更新で "Thinking..." → 回答が自動再描画 | even-toolkit `useGlasses.ts` |
| 手書きページング | even-toolkit `paginateText` / `wordWrap`、長文リストは `buildScrollableList` / `slidingWindowStart` | even-toolkit `glass-display-builders.ts` / `paginate-text.ts` |

---

## 検証で確定したリスク（必ず DoD へ反映）

サブエージェント検証（2026-06-08・一次情報照合）で判明した、PoC が詰まる3大ポイント:

1. **認証 preHandler が CORS preflight を壊す**: `Authorization` + JSON の POST は OPTIONS preflight を発火。仕様書 §8 サンプルの preHandler は `/health` のみ除外で **OPTIONS を 401 で弾く潜在バグ**。→ OPTIONS と `/health` を認証スキップ対象にし、preflight が 200/204 を返すことを検証する。
2. **タイムアウト欠如 × Hermes の長尺応答**: Hermes は**エージェント**で応答に `function_call` が混ざり数十秒〜分かかり得る。G2→Bridge / Bridge→Hermes 両方の `fetch` に `AbortController` タイムアウトが無いと G2 が無限「Thinking…」。→ 両方にタイムアウト + 超過時の G2 表示。
3. **WebView の実 Origin 未確認**: iOS WKWebView は `null` origin を送ることがあり `origin:true` でも通らない場合。→ Phase 1 最初に `req.headers.origin` をログ採取して実値を確定し、CORS 方針を決める。

その他確認済み（✅妥当）: Hermes API Server は実在・`/v1/responses` 契約と `extractOutputText`（`message`→`output_text`、`function_call` をスキップ）は正しい・`previous_response_id` で会話継続可・whitelist は origin 単位でポート込み full origin・wildcard/bare hostname 不可・localhost はスマホ自身を指すので **Mac の Tailscale IP（`100.x.x.x`）を使う**。

> **ネットワークは Tailscale 限定（2026-06-08 確定）**: LAN IP は実機で固まる既知問題のため使わない（memory `g2-sideload-workflow`）。Tailscale IP はデバイス単位で安定し、再 sideload なしで whitelist を固定できる。さらに Tailscale は WireGuard でトランスポート暗号化するため、Phase 1 の HTTP 平文 LAN リスクは実質緩和される（Bearer Token がトンネル外に平文で流れない）。

---

## Phase 0: 足場（scaffold + baseline）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 0.1 | ルート `package.json` の `workspaces` を `["apps/*", "servers/*"]` に拡張し、`servers/` ディレクトリを用意 [tdd:skip:config-only] | `bun install` がエラー0で通り、`servers/*` が workspace として認識される。`apps/hisho` のビルド/型に影響なし（`apps/hisho` は読み取りのみ・改変禁止） | - | cc:完了 [288a5fc] |
| 0.2 | Bridge Server パッケージ雛形 `servers/g2-hermes-bridge`（Fastify + @fastify/cors + zod、TS、biome、`bun test` 前提。`.env.example` に PORT/BRIDGE_TOKEN/HERMES_BASE_URL/HERMES_API_KEY） [tdd:skip:scaffold-only] | `bun run --filter g2-hermes-bridge build`（tsc）成功、`biome check` エラー0、`.env.example` あり（実 `.env` は gitignore） | 0.1 | cc:完了 [58eba3f] |
| 0.3 | G2 クライアント雛形 `apps/g2hermes`（Vite+TS+React+even-toolkit、hisho の vite/biome/tsconfig を踏襲）+ `app.json`（package_id `com.frogman.g2hermes`、network whitelist のみ。**マイク権限は入れない**=Phase 1 はテキストのみ） [tdd:skip:scaffold-only] | `bun run --filter g2hermes build` 成功、`biome check` エラー0、`app.json` が evenhub-cli で valid | 0.1 | cc:TODO |

## Phase 1: テキスト Bridge PoC

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | Hermes API Server 有効化 + 契約 smoke（コードではなく手順 + 確認）。`~/.hermes/.env` に `API_SERVER_ENABLED=true` / `API_SERVER_KEY=<実値>`、`hermes gateway` 起動、`curl /v1/responses` で応答取得 [tdd:skip:external-setup] | `curl http://127.0.0.1:8642/v1/responses`（Bearer 付き）が 200 で `output[].content[].type==='output_text'` を含む。`function_call` 混入応答でも本文が取れることを1回確認。`previous_response_id` で2ターン会話継続を確認。`API_SERVER_KEY` は `change-me-local-dev` のままにしない | 0.2 | cc:TODO |
| 1.2 | Bridge ピュア関数を **TDD** で実装: `extractOutputText`（`message`/`output_text` 抽出・`function_call` スキップ）/ `paginateForG2`（90字・空白正規化）/ 日本語を含む長文の分割 [tdd:required] | `bun test` グリーン。`function_call`+`message` 混在の実レスポンス JSON フィクスチャで本文のみ抽出。日本語90字超が複数ページに分割され各ページ ≤90字 | 0.2 | cc:TODO |
| 1.3 | Bridge ルート実装: `GET /health`（自身 + Hermes 到達性 `checkHermes`）/ `POST /v1/ask`（zod 検証・`Bearer` 認証・`previous_response_id` セッション・short instructions）。**CORS は OPTIONS と /health を認証スキップ**し preflight を壊さない。`origin` をログ採取。Bridge→Hermes に `AbortController` タイムアウト [tdd:skip:integration-curl] | `curl` で: トークン無 `/v1/ask` が 401 / 正規トークンで 200 + `pages` 返却 / `OPTIONS /v1/ask`（Origin+Access-Control-Request-* 付き）が 200/204 で CORS ヘッダ付与 / Hermes 停止時に分かるエラー / タイムアウト超過で 504 系。`biome check` 0、`bun run build` 成功 | 1.1, 1.2 | cc:TODO |
| 1.4 | G2 クライアント実装（even-toolkit）: `api/bridgeClient.ts`（`/v1/ask` fetch・Bearer・`AbortController` タイムアウト）+ Ask/Next/Exit メニュー画面（`GlassScreen` の display/action）+ App で Hermes 呼び出しを **React state 経由**（idle→Thinking→回答ページ）に配線。Next でページ送り、ダブルタップで戻る/終了 [tdd:skip:integration-simulator] | `bun run build` 成功・`biome check` 0。シミュレーターで Ask→"Thinking…"→回答表示、↕でメニュー移動、Next で次ページ、ダブルタップで戻る、を確認 | 0.3, 1.3 | cc:TODO |
| 1.5 | エンドツーエンド検証 + v0.1.0 パッケージング。実機 WebView の `Origin` 実値を採取し CORS 方針を確定、preflight 通過・タイムアウト挙動・会話継続・秘密境界（Hermes Key が WebView/通信に出ない）を確認。app.json whitelist は **Tailscale IP の full origin（`http://100.x.x.x:PORT`）のみ**記載（LAN IP は使わない）、`bun run build` + `evenhub pack` で `.ehpk` 生成 [tdd:skip:integration-e2e] | Hub In-Development or sideload 経由で G2 に Hermes 回答が表示される。`req.headers.origin` 実値を計画ノートに記録。`g2hermes.ehpk` 生成。実機最終確認はユーザー実施 | 1.4 | cc:TODO |

### スコープ外（Phase 1 に含めない）

- G2 マイク入力 / PCM 取得 / STT（仕様書 §13 Phase 3・§9.1）
- TTS（Mac `say` / 音声ファイル再生。仕様書 §13 Phase 4・§9.2）
- 常用化: Cloudflare Tunnel 固定ドメイン / HTTPS / JWT / rate limit（仕様書 §13 Phase 5・§10.2）
- WebSocket 音声ストリーミング（仕様書 §5.3）

### 検証メモ（記入用）

- [ ] 実機 WebView の `Origin` 実値: （1.5 で記録）
- [ ] Mac の Tailscale IP（whitelist 用・`100.x.x.x`）: （1.5 で記録）
- [ ] Hermes 応答の実レイテンシ（ツール実行時）: （1.1/1.5 で記録）

## 制約

- **`apps/hisho/` は一切改変しない**（読み取り・参照のみ。ユーザー指示 2026-06-08）。`apps/hisho/preview/design-mock.html` は保護ファイル。
- G2 表示は実機 line height 27px・**最大10行**・576×288px・4bit 緑階調。回答は短文化（instructions + `paginateForG2`）。
- **ネットワークは Tailscale 限定**。whitelist は Mac の Tailscale IP（`http://100.x.x.x:PORT`）の full origin のみ。LAN IP は実機で固まるため使わない（memory `g2-sideload-workflow`）。
- app.json の network whitelist は **CORS 回避ではない**。Bridge 側で CORS ヘッダ + OPTIONS 応答が別途必要。whitelist は **ポート込み full origin**・wildcard/bare hostname 不可。
- 秘密情報: `HERMES_API_KEY` を WebView に出さない。Bridge Token と Hermes Key を分ける。`.env` は gitignore、`change-me-local-dev` を実値に置換。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` スキルを必ず invoke すること（hisho 計画と同規約）。

### Notes

- Created via: harness-plan create（サブエージェント検証付き・2026-06-08）
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`、task ledger = 本 `Plans.md`
