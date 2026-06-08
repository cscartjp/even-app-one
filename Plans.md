# G2 Hermes Bridge v0.1.0 Plans.md

作成日: 2026-06-08

新規アプリ。Even G2 から Mac 上の Hermes Agent へ **テキストで問い合わせ → G2 に回答表示** する薄いブリッジ（Phase 1 テキスト PoC）。
**Phase 3（2026-06-08 追加）で「G2 マイク音声入力 → STT → Hermes 回答表示」を実装範囲に追加**（仕様書 §13 Phase 3 / §9.1 / §5.2）。TTS / 常用化（Tunnel・HTTPS・JWT）は引き続きスコープ外（仕様書 §13 Phase 4 以降）。

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
- **デプロイ・トポロジ（2026-06-08 確定 = 構成 B-1）**: Bridge と Hermes は**同一 Mac（Mac B = Hermes が動く Mac）に同居**。phone→Bridge は Mac B の Tailscale IP へ Tailscale 直（`http://<MacB-Tailscale-IP>:8787`）、Bridge→Hermes は同マシン loopback（`http://127.0.0.1:8642/v1`）で **SSH トンネル不要**。コードは開発機（Mac A）から `servers/g2-hermes-bridge` を rsync 配置し `bun src/index.ts` で起動（常時自動起動は issue #20 で launchd plist 化）。`app.json` の whitelist は **placeholder（`100.64.0.1`）を commit し、`evenhub pack` 前にローカルで Mac B の実 Tailscale IP に置換**する（実 IP は公開 repo に出さない）。※当初 Mac A から SSH トンネルで Hermes へ繋ぎ 1.1/1.3 を live 検証したが、Mac A 非依存の要望により最終構成は本同居とし Mac A・トンネルを廃止。

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

### 検証メモ（記入用）

- [x] 実機 WebView の `Origin` 実値（2026-06-08 採取・Mac B Bridge ログ）: **`http://127.0.0.1:<ランダムポート>`**（実機 G2 / Even Hub WebView がパッケージアプリをローカル配信。ポートは起動毎に変動）。シミュレーター=`http://localhost:5174`、curl/一部 GET=`null`。**mixed-content 解消**: 実機 Origin が `http://` のため `http://` Bridge への fetch は同スキームで通り、HTTPS 化（Tailscale Serve 等）は Phase 1 では不要だった（PR #21 の懸念は不発）。CORS allowlist を締める場合はポート固定不可のため `http://127.0.0.1`/`http://localhost` のポートワイルドカード方針。
- [x] Mac B（Hermes 同居機）の Tailscale IP（whitelist 用）: 確定済み。**実値は公開 repo に書かずローカルにのみ保持**し、`app.json` は placeholder（`100.64.0.1`）を commit、`evenhub pack` 前にローカルで実 IP へ置換（B-1）
- [ ] Hermes 応答の実レイテンシ（ツール実行時）: （1.1/1.5 で記録）

## Phase 3: G2 音声入力（STT）— v0.2.0 目標

> 追加日: 2026-06-08（`/harness-work 3.0` 起点）。**team_validation_mode: `subagent`**（Explore で even-toolkit audio API、general-purpose で 権限/レイテンシ/転送方式リスクを 2026-06-08 に検証。2 視点が独立に「案C=サーバ側STT が最小変更」「実機マイク権限が最大リスクで gating spike 必須」へ収束）。

> **バージョン方針**: v0.1.0 は実機にインストール済みのため、同一バージョンだと G2 がアップデートを認識しない。実機に載せる中間ビルド（3.0〜3.4）は `app.json` の `version` を**パッチバンプ**（0.1.1, 0.1.2, …）して pack する。`0.2.0` は Phase 3 完了（3.5）のリリース版に温存。実 IP は placeholder のみ commit し pack 前にローカルで置換する既存運用は維持。

**アーキテクチャ（確定）**: G2 マイク → even-toolkit `GlassBridgeSource`（`audioControl` 経由で生 PCM 取得）→ WebView でバッファ → **録音終了時に単発アップロード**（HTTP チャンク連打 / WebSocket は不採用）→ Bridge `POST /v1/stt`（Bearer 認証・proxy）→ **Mac B の warm mlx-whisper サイドカー**（`whisper-large-v3-mlx`・モデル1回ロード常駐）→ transcript → **既存 `/v1/ask` で Hermes**（Phase 1 の検証済みパスを無改変で再利用）→ pages 表示。音声・STT は **Mac B ローカル完結で外部送信ゼロ**（案C: API キー不要・課金ゼロ・プライバシー◎。memory `stt-mac-b-mlx-whisper`）。

### 設計上の正本差分（仕様書 §5.2/§7.2/§9.1 からの読み替え）

| 仕様書サンプル | 本アプリ（確定） | 根拠 |
|---|---|---|
| 生 SDK `audioControl`+`onEvenHubEvent` 直叩き | even-toolkit `GlassBridgeSource`（`onAudioData` で PCM 取得）+ `float32ToWav`/`createVAD` を部品利用 | Explore 検証（`node_modules/even-toolkit/stt/sources/glass-bridge.ts` 他） |
| `/v1/audio/start`+`/chunk`(100回/秒連打)+`/finish` の 3 エンドポイント | 単発 `POST /v1/stt`（録音終了時に全 PCM/WAV を 1 回 POST。≤15秒≈640KB base64 で 1 POST 可）。transcript を返し、Hermes は既存 `/v1/ask` を再利用 | Skeptic 検証（チャンク連打は欠落/順序逆転・§19 WebSocket 不安定） |
| STT 候補: Whisper API / Groq / faster-whisper | Mac B 既設 **mlx-whisper warm サイドカー**（案C） | ユーザー確定（memory `stt-mac-b-mlx-whisper`） |
| even-toolkit `useSTT`+`whisper-api` プロバイダ | **不採用**（whisper-api は OpenAI URL ハードコード・apiKey 必須で Mac B サイドカーを指せない） | Explore 検証（`providers/whisper-api.ts`） |

**Spec delta（Phase 3, 2026-06-08）**: product contract（`docs/spec/g2-hermes-bridge.md` §13 Phase 3 / §9.1 / §5.2）は音声入力を既に定義済み。本 Plans.md は **API 形（単発 `/v1/stt` 1 エンドポイント）・STT 実体（Mac B mlx-whisper サイドカー）・取得経路（even-toolkit GlassBridgeSource）を上書き確定**する（precedence: spec > Plans だが、実装読み替えは本表で明示）。ユーザー可視の振る舞い（音声で質問→回答表示）は spec から不変。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.0 | **[gating spike]** マイク権限 + PCM 受信の実機 de-risk。g2hermes に一時マイク probe（`GlassBridgeSource` で `audioControl(true)` → 受信 PCM の `typeof`/`byteLength`/先頭バイトを glass テキスト表示 + `console.log`）を最小実装。Hub In-Development で**ユーザーが実機確認**。**`audioPcm` が届かなければ GPS 前例（memory `reference_hub_dev_mode`）同様の権限ブロックとして Phase 3 を停止しユーザー判断へ** [tdd:skip:hardware-spike] | 実機で `audioPcm` が `Uint8Array`（byteLength>0）で届くことをユーザーがログ/表示で確認 **または** 届かないことを確認して GitHub issue 化し停止。結果を下記検証メモに記録 | 1.5 | cc:WIP |
| 3.1 | **[spike]** PCM 形式確定。3.0 の生 PCM をダンプし sampleRate/signed/endian/channel を確定。ダンプ→WAV(s16le 16kHz mono)→再生で肉声確認し、Bridge 側 WAV 化方式（ヘッダ生成 or ffmpeg）を決める [tdd:skip:hardware-spike] | PCM 実形式を検証メモに記録。ダンプ PCM から生成した WAV が再生可能で肉声と一致 | 3.0 | cc:TODO |
| 3.2 | **Mac B STT warm サイドカー**。mlx-whisper（`whisper-large-v3-mlx`）をモデル warm 常駐する最小 HTTP サービス `servers/stt-sidecar`（`.venv` 3.12・`POST /v1/audio/transcriptions` で WAV/multipart → `{text}`・日本語指定・幻覚リピート除去流用）。launchd plist は既存 Bridge plist と同様に repo 配置（memory `feedback-keep-deploy-artifacts-in-repo`）。warm 推論レイテンシ計測 [tdd:required] | サイドカー起動でモデル 1 回ロード、WAV POST で日本語 transcript 返却、15秒音声の warm 推論レイテンシを検証メモに記録（目標 ≤ 数秒）。pure 変換部は単体テスト | 3.1 | cc:TODO |
| 3.3 | **Bridge `/v1/stt` ルート + STT proxy**。受信音声（単発: WAV or PCM base64）→（PCM なら WAV 化）→ Mac B サイドカーへ proxy → `{transcript}` 返却。Bearer 認証・`AbortController` タイムアウト・処理後バッファ即削除。`config.ts` に `STT_BASE_URL`/`STT_TIMEOUT_MS` 追加。Hermes は無改変の既存 `/v1/ask` を client が続けて呼ぶ [tdd:required] | `bun test` グリーン（inject: 認証401・タイムアウト504系・proxy mock で transcript 返却・処理後バッファ削除）、`biome check` 0、`bun run build` 成功 | 3.1, 3.2 | cc:TODO |
| 3.4 | **g2hermes 音声入力 UI**（even-toolkit `GlassBridgeSource`）。idle メニューに「🎤 音声で質問」追加 → 録音開始（"Listening…"）→ 終了ジェスチャで `audioControl(false)` → PCM 結合 → `/v1/stt` POST → 「聞き取り: <transcript>」表示 → 既存 `askBridge`(/v1/ask) で回答ページ。`AbortController` タイムアウト。プレビュー/シミュレーターは getUserMedia フォールバック or スキップ [tdd:skip:integration-simulator] | `bun run build` 成功・`biome check` 0。シミュレーターで状態遷移（idle→listening→transcribing→answer）動作（実音声は 3.5） | 3.0, 3.3 | cc:TODO |
| 3.5 | **実機 E2E + v0.2.0 パッケージング**。実機 G2 で「音声で質問→Listening→聞き取り表示→Hermes 回答表示」を達成。実レイテンシ記録・秘密境界（音声/STT が Mac B ローカル完結・外部送信ゼロ）確認・`evenhub pack` で `g2hermes-v0.2.0.ehpk` 生成 [tdd:skip:integration-e2e] | 実機で音声→回答が表示、実レイテンシを検証メモに記録、`.ehpk`(v0.2.0) 生成。実機最終確認はユーザー実施 | 3.4 | cc:TODO |

### 検証メモ（Phase 3・記入用）

- [ ] 実機マイク権限: `audioControl(true)` で `audioEvent.audioPcm` が届くか（3.0・GPS 前例との差を確認）
- [ ] PCM 実形式: sampleRate / signed / endian / channel（3.1）
- [ ] warm mlx-whisper の実レイテンシ（15秒音声・3.2）
- [ ] 実機 E2E レイテンシ（音声→回答・3.5）

## 制約

- **`apps/hisho/` は一切改変しない**（読み取り・参照のみ。ユーザー指示 2026-06-08）。`apps/hisho/preview/design-mock.html` は保護ファイル。
- G2 表示は実機 line height 27px・**最大10行**・576×288px・4bit 緑階調。回答は短文化（instructions + `paginateForG2`）。
- **ネットワークは Tailscale 限定**。whitelist は Mac の Tailscale IP（`http://100.x.x.x:PORT`）の full origin のみ。LAN IP は実機で固まるため使わない（memory `g2-sideload-workflow`）。
- app.json の network whitelist は **CORS 回避ではない**。Bridge 側で CORS ヘッダ + OPTIONS 応答が別途必要。whitelist は **ポート込み full origin**・wildcard/bare hostname 不可。
- 秘密情報: `HERMES_API_KEY` を WebView に出さない。Bridge Token と Hermes Key を分ける。`.env` は gitignore、`change-me-local-dev` を実値に置換。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` スキルを必ず invoke すること（hisho 計画と同規約）。
- **実装プロセス（ユーザー指示 2026-06-08）**: 実装開始時はブランチを切る（main に直接コミットしない）。**PR を出す前に Codex Review（公式 `/codex:review` 正規ルート）を必ず通す**。
- **Phase 3 の gating**: マイク権限（`g2-microphone` / `audioControl`）が実機で取れるかを 3.0 で最優先に確認する。GPS 権限が実機で取れなかった前例（memory `reference_hub_dev_mode`）があるため、3.0 が失敗したら Phase 3 を停止しユーザー判断へ上げる（パイプラインを先に作らない）。

### Notes

- Created via: harness-plan create（サブエージェント検証付き・2026-06-08）
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`、task ledger = 本 `Plans.md`
