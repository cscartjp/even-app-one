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

## Phase 3: 音声入力（G2マイク → ローカル STT → Hermes）

> **Spec delta（2026-06-08・承認済み）**: product contract `docs/spec/g2-hermes-bridge.md` §13 Phase 3 を具体化する設計デルタを `docs/spec/g2-hermes-phase3-voice.md` として新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > 本 `Plans.md`。Phase 1 資産（`/v1/ask`・`paginateForG2`・session）は**無改変再利用**。
>
> **team_validation_mode**: `subagent`（2026-06-08。Explore×2 で even-toolkit/stt・SDK 型を一次照合〔判定D: provider はクラウド固定・`GlassBridgeSource` で生 PCM 取得〕、Skeptic/Security/QA 複合レビューで分解を検証〔BLOCKER2/HIGH5/MEDIUM5 を反映〕。Product/Architecture は brainstorming で user 承認）。harness-mem 照合済: `stt-mac-b-mlx-whisper` / `reference_hub_dev_mode` / `g2-sideload-workflow` / `feedback-keep-deploy-artifacts-in-repo`。
>
> **ゲート方針**: **3.0（実機マイク到達性）が通るまでサイドカー本実装 3.1.1 以降の重い投資は本格化しない**。3.0 が blocked の場合、並列安全タスク（3.1.0 / 3.3.1 / 3.4.1 / 3.2.1 のルート骨格）のみ前進し、代替（`phone-microphone` 等）を検討。
>
> **lint/format baseline**: TS = biome（既存）。Python サイドカーは新規のため 3.1.0 で ruff/pytest を先行設置。
> **前提**: Phase 1 の Bridge が Mac B で launchd 稼働中。Phase 3 は既存 `servers/g2-hermes-bridge` にルート追加 + 新規 STT サイドカー。

### Phase 3.0: ゲート（実機マイク到達性スパイク）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.0 | 実機マイク到達性スパイク。捨て（or 正式版）`app.json` に `g2-microphone` を足し、最小キャプチャ + console ログをサイドロード。**シミュレーター不可（Mac マイク代替で `g2-microphone` 権限フローを検証できない）＝実機のみ**。先に配布経路（sideload / Hub In-Development）を決める。実機操作はユーザー [tdd:skip:throwaway-spike] | 実機で `audioControl(true)` が `true` を返し、`audioEvent.audioPcm`（非空 Uint8Array）が console に届くことをユーザーが確認・記録。**シミュレーター green は不可**。権限が降りない/拒否なら `blocked` にし `phone-microphone` 等の代替を検討 | - | cc:完了（2026-06-09 実機確認OK・**gating PASS**: PR #27 で g2hermes に menu「🎤 マイク診断」+ probe（`src/even/mic-probe.ts`＝`audioControl(true)`→`onEvenHubEvent` で `audioPcm` を観測、SDK 直叩き隔離）を実装、`app.json` に `g2-microphone` 追加、**v0.1.1** に bump して `evenhub pack`→Hub In-Development で実機 G2 に載せユーザー確認。`audioControl` 起動OK・`PCM events`/`bytes` 増加。**GPS 型権限ブロックは不発＝マイクは動く**。**PCM 実形式確定**: `first: len=3200`B/イベント＝1600サンプル＝**100msチャンク**（約10ev/s）、先頭バイト `[4 251 255 6 9 254 255 2 0]`→**16kHz / mono / s16le**（`ffmpeg -f s16le -ar 16000 -ac 1` 可。仕様書の「40バイト/フレーム」は誤り）。3.1.1/3.3.1/3.3.2 の WAV 化はこの形式前提。probe の `probe` phase は暫定で 3.4.2 の録音状態機械で置換予定） |

### Phase 3.1: STT サイドカー（Mac B・ローカル mlx-whisper）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.1.0 | Python サイドカー tooling baseline。配置 `servers/g2-hermes-stt`（Mac B では `~/ai/.venv` 3.12 で実行）。ruff + pytest 設定 [tdd:skip:setup] | `ruff check` 0、`pytest -q` が exit 0（collect 0 回避のため最小 smoke 1件を置く） | - | cc:完了（`servers/g2-hermes-stt`＝uv + hatchling + src レイアウト、ruff + pytest 設定。mlx-whisper は `inference` extra に分離〔Apple Silicon 限定・ピュア関数テスト/lint には不要〕。Mac A で `uv run ruff check` 0・`uv run pytest -q` exit 0〔smoke 1件で collect-0 回避〕。**訂正**: 計画前提の Mac B `~/ai/.venv` は不在。実際の mlx 環境は `~/VSCodeProjects/creatorzz/.venv`〔py3.12.13 + mlx_whisper〕、モデルは `~/ai/models/hub` に DL 済み〔HF_HOME=~/ai/models〕。専用 venv 構築は 3.1.2 deploy で確定） |
| 3.1.1 | サイドカー実装: mlx-whisper（`whisper-large-v3-mlx`）warm 常駐、`POST /transcribe`（WAV bytes・**メモリ Buffer 直渡しでディスク回避を優先**）→`{text,ms}`、`GET /health`（loaded 真偽）、**127.0.0.1 のみ bind**、日本語 + 幻覚リピート除去。**Mac B の `~/ai/transcribe.py` 実在を確認し当該ロジック流用、無ければ language=ja + 幻覚除去を新規実装**。同時リクエストは直列化 or 503 [tdd:required] | pytest で既知 WAV フィクスチャ→text に期待語が**含まれる**（実推論は非決定的なため緩い assert）。`/health` loaded=true。`lsof -nP -iTCP:8643 -sTCP:LISTEN` が `127.0.0.1:8643` のみ（`*`/`0.0.0.0` でない）。**large-v3 常駐 RSS を実測し Mac B RAM で Hermes 同居・スワップ無し**。`float32ToWav` 出力 WAV を読める（不可なら soundfile/ffmpeg 経由）。空/極短/無音で幻覚テキストを返さない（or 呼び出し側で弾く前提を明記） | 3.0, 3.1.0 | cc:完了（stdlib http.server〔単一スレッド＝mlx 推論を自然に直列化〕+ mlx-whisper `whisper-large-v3-mlx`。`text.clean`/`audio.decode_wav`/`transcribe.transcribe_wav`〔recognizer 注入〕/`server` ルーティングを **TDD**〔Mac A 22 pass・ruff 0、mlx 無しで決定的に検証可〕。実推論は `whisper.make_recognizer` に隔離し mlx import を遅延。**メモリ直渡し**でディスク不使用。流用元 = Mac B `~/VSCodeProjects/creatorzz/transcribe.py` の language=ja + 幻覚除去〔`(.{2,12}?)\1{3,}`→畳む〕。**Mac B 実機検証 2026-06-09**: warm ~15s→`/health` loaded=true、`lsof`=`127.0.0.1:8643` のみ〔`*`/`0.0.0.0` でない〕、Mac A から Tailscale IP:8643 接続不可〔curl exit7＝loopback 実証・3.1.2 先取り〕、**RSS 3.48GB・Hermes(:8642) 同居・swap 0.00M/空き83%**、実推論 jp.wav〔`say -v Kyoko 音声認識のテストです`〕→`音声認識のテストです。`(1290ms)、短WAV 0.1s→`{text:"",ms:0}` 幻覚なし。even-toolkit `float32ToWav` 実出力を `decode_wav` で読めることを直接確認。極短ガード=0.3s 未満。size上限/timeout/415 は Bridge 3.2.1 担当。**Code Reviewer 独立レビュー反映**: MEDIUM〔warm 失敗の握り潰し→`warm_and_flag` で stderr ログ・loaded=False 維持〕/ LOW〔nchannels 検証追加・STT_HOST 廃止で bind を 127.0.0.1 固定・recognizer 実行時例外→500+stderr〕を TDD で対応〔+5 テスト=計22〕） |
| 3.1.2 | launchd plist `com.frogman.g2hermes-stt`（RunAtLoad/KeepAlive/ThrottleInterval）+ repo 配置（memory `feedback-keep-deploy-artifacts-in-repo`） [tdd:skip:deploy-config] | launchctl 常駐、`kill -9`→自動復帰し /health loaded=true まで戻る（再ロード秒数を記録）、`launchctl kickstart -k` 後 /health 200。plist を repo に残す。**Tailscale IP から 8643 へ接続不可**を確認（loopback 実証） | 3.1.1 | cc:完了（2026-06-09 Mac B 実機常駐 **PASS**。`deploy/com.frogman.g2hermes-stt.plist`〔RunAtLoad/KeepAlive/ThrottleInterval 30s・`uv run --extra inference python -m g2_hermes_stt`・HF_HOME=~/ai/models・log `~/g2stt.{log,err}`〕。配置=Mac A から rsync + `uv sync --extra inference`〔mlx 0.31.2 / mlx-whisper 0.4.3〕を **ssh 代行**、launchctl 登録のみユーザー〔GUI domain〕。**受け入れ全 PASS**: `/health` loaded=true、`kill -9`→**7s 自動復帰**、`launchctl kickstart -k`→**6s** 復帰、**loopback 実証**=Mac A から Tailscale IP:8643 接続不可〔curl exit7〕・対照 Bridge:8787=200。Mac B 実測で uv 絶対パス `/Users/yoshiura/.local/bin/uv` 確定〔**STT コードは Mac B 未配置だった**=Bridge のみ既存・今回 rsync 配置〕。README に常駐手順+受け入れ確認+別 Mac 移設の書き換え項目。**Codex review 不具合なし**。PR #31） |

### Phase 3.2: Bridge ルート（既存サーバーに追加）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.2.1 | `POST /v1/transcribe`: **`addContentTypeParser('audio/wav', { parseAs: 'buffer' })` で raw Buffer 受信**（`parseAs:'buffer'` 未指定だと文字列化され WAV が壊れる）、Bearer、size 上限→413、`AbortController`→504、**サイドカー不達→502**、OPTIONS 認証スキップ。サイドカーへ転送。一時データはメモリ優先（ディスクなら 0600+finally 削除）。ルート骨格+inject は 3.1.1 を待たず着手可、実サイドカー curl だけ 3.1.1 依存 [tdd:required]（fetchImpl でサイドカーをモック） | inject テストで 401（無トークン）/ 200+`{text}` / **415 でない（audio/wav parser 登録済）** / OPTIONS 204+CORS（audio/wav preflight 通過）/ 413（size超）/ 502（不達）/ 504（timeout）。biome 0、build 成功 | -（骨格+injectは独立。実サイドカー curl のみ 3.1.1） | cc:完了 [6280200]（`stt-client.ts` 新設＋`POST /v1/transcribe`。**メモリ直渡し**でディスク不使用。inject 10本＋config 2本で `bun test` 39 pass・biome 0・build OK。Code Reviewer エージェント独立レビュー APPROVE〔hermes-client パターン踏襲・error→status 取りこぼし無し・`/v1/ask` への副作用無し〕。指摘の非2xx→502 テストを追加。parser `bodyLimit`(2MB)>global 1MB を 1.5MB→200 で実機確認。**実サイドカー curl は 3.1.1 待ち**） |
| 3.2.2 | `GET /health` 拡張: STT 到達性 `stt` フィールド追加 [tdd:required] | fetchImpl モックで stt 200→reachable / ECONNREFUSED→unreachable に切り替わる inject テスト。biome 0 | 3.2.1 | cc:TODO |

### Phase 3.3: クライアント音声キャプチャ（even-toolkit 流用）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.3.1 | even-toolkit/stt の export 実体確認（`GlassBridgeSource` / `createAudioBuffer` / `float32ToWav` の正確な名・signature）。`bun install` 済みで `even-toolkit/stt` が解決することを確認。無ければ自前 WAV エンコーダ（44byte header + Int16）方針を確定 [tdd:skip:investigation] | 正確な export 名・引数を設計ノート（spec §9-1）に記録。解決不能なら自前エンコーダ方針を記録 | - | cc:完了 [2e9baac]（even-toolkit **v1.7.2** の `dist/stt/*.d.ts` を直読し spec §9.1 に記録。`even-toolkit/stt` サブパス解決OK。`GlassBridgeSource`=**class**（`new`・`window.__evenBridge` 自動検出・16000Hz・`onAudioData(cb:(pcm:Float32Array,sampleRate:number))`）/ `createAudioBuffer(config?)`=factory（`getWav()`→**WAV Blob**）/ `float32ToWav(data,sampleRate)`→**Blob**。**自前エンコーダ不要**と確定。3.3.2 は WAV Blob を `fetch` body 直渡し＋`Content-Type:audio/wav` 明示） |
| 3.3.2 | 音声キャプチャ + WAV化 + POST: `bridgeClient` に `transcribe()` 追加、`AbortController`、最大30s タイマー、停止/終了/`beforeunload` で `source.stop()`（`audioControl(false)`）。空/極短録音はクライアント閾値で弾き recording へ戻す [tdd:required] | PCM→WAV ユニット（無音/最大長/通常）green、空/極短を弾く判定のユニット green、biome 0、build 成功 | 3.2.1, 3.3.1 | cc:TODO |

### Phase 3.4: 状態機械 + 権限

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.4.1 | `app.json` に `g2-microphone` 権限追加（`desc` は審査向け文言＝spec §4.6）。network whitelist は不変 [tdd:skip:config] | `app.json` に `g2-microphone` と desc 文言が実在、evenhub-cli で valid、network whitelist 不変 | - | cc:完了（PR #27 で `g2-microphone`+desc 追加済み・network whitelist 不変・`evenhub pack` valid。3.0 実機検証もこの権限で通過） |
| 3.4.2 | 状態機械拡張 `idle→recording→transcribing→review→thinking→answer` + `screen.ts` action（録音開始/停止/送信/録り直し）、idle にプリセット併存、error 表示。**recording 中 background→foreground で `audioControl` が閉じ/復帰**（`everything-evenhub:background-state`）。recording 表示は静的 or 更新 ≤1s で BLE 過負荷回避 [tdd:required]（reducer ユニット。シミュレーター部分は integration） | 状態遷移 reducer ユニット green。シミュレーターで状態遷移とモック PCM の配線確認（実音声は 3.5.1）。background→foreground でマイクが閉じ/復帰する確認。biome 0、build 成功 | 3.3.2, 3.4.1 | cc:TODO |

### Phase 3.5: E2E + パッケージング

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.5.1 | 実機 E2E（録音→ローカル文字起こし→確認→Hermes 回答）。レイテンシ P50/P95 実測、実機 `audioPcm` 到達、マイク許可フロー確定、秘密境界確認、`.ehpk` 生成。whitelist は Tailscale IP full origin（placeholder commit→pack 前ローカル置換。**既存 `apps/g2hermes/app.json` の whitelist が placeholder 運用に沿っているか確認・是正も含む**） [tdd:skip:integration-e2e] | 実機で E2E 成功。P50/P95 記録し Bridge transcribe タイムアウト ≥ P95×2。**tcpdump/ログで音声が Tailscale 外に平文流出しない・`HERMES_API_KEY` が WebView bundle/通信に出ない**ことを各1回確認。`g2hermes.ehpk` 生成。実機最終確認はユーザー | 3.1.2, 3.2.2, 3.4.2 | cc:TODO |

### Phase 3 スコープ外

- リアルタイム途中字幕（streaming STT・WebSocket）／ TTS（§13 Phase 4）／ 常用化: Tunnel・HTTPS・JWT・rate limit（§13 Phase 5）／ 音声コマンド操作。

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
