# G2 Hermes Bridge v0.1.0 Plans.md

作成日: 2026-06-08

新規アプリ。Even G2 から Mac 上の Hermes Agent へ **テキストで問い合わせ → G2 に回答表示** する薄いブリッジ（Phase 1 テキスト PoC）。
音声 / STT / TTS / 常用化（Tunnel・HTTPS・JWT）は本計画のスコープ外（仕様書 §13 の Phase 2 以降）。

- **product contract（正本）**: `docs/spec/g2-hermes-bridge.md`（デスクトップ仕様書を 2026-06-08 にリポジトリへ取り込み。Phase 1 はこの §1〜§8・§11・§13 Phase 1・§16 を正解条件とする）
- **precedence**: `docs/spec/g2-hermes-bridge.md` > 本 `Plans.md`
- **Spec delta（2026-06-08）**: リポジトリに root `spec.md` は無いため、新アプリの product contract を `docs/spec/g2-hermes-bridge.md` として新設（=デスクトップ仕様書の取り込み）。Phase 1 では仕様書サンプルの **生 SDK 記述を even-toolkit API へ読み替える**点を本計画で上書き定義する（下記「設計上の正本差分」）。
- **team_validation_mode**: `subagent`（2026-06-08 に Explore で even-toolkit API、general-purpose で Hermes/CORS/セキュリティを一次情報照合済み。結論: 実現可能・要注意点3件を DoD 化）

> 関連: 過去の経緯は memory `hisho-train-app-design` / `g2-sideload-workflow` / `reference_hub_dev_mode`。完了済み Hisho 計画は `docs/plans/hisho-v0.1.4-v0.1.7.md`。
> **完了済み Phase のアーカイブ（2026-06-09）**: Phase 0（足場）と Phase 1（テキスト Bridge PoC）は全タスク完了のため `docs/plans/g2-hermes-bridge-phase0-1.md` へ退避。アーキテクチャ・制約・進行中の Phase 2 / Phase 3 は本ファイルに残す。

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

## Phase 0 / Phase 1（完了・アーカイブ済み）

Phase 0（足場: workspaces 拡張 / Bridge 雛形 / G2 クライアント雛形）と Phase 1（テキスト Bridge PoC: Hermes 契約 smoke / ピュア関数 TDD / Bridge ルート / G2 クライアント / 実機 E2E + v0.1.0 パッケージング）は**全タスク `cc:完了`**。詳細・DoD・検証メモは **`docs/plans/g2-hermes-bridge-phase0-1.md`** に退避。

実機 Origin 実値（`http://127.0.0.1:<ランダムポート>`）・Mac B Tailscale IP 運用（placeholder commit→pack 前置換 = B-1）などの確定事項もアーカイブ側に記録済み。

## Phase 2: コンパニオン カスタム質問（issue #30）

> **Spec delta（2026-06-09・確定）**: product contract `docs/spec/g2-hermes-bridge.md` の上に、コンパニオン画面からカスタム質問を編集・送信する機能を `docs/spec/g2-hermes-companion-custom-questions.md` として新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-companion-custom-questions.md` > 本 `Plans.md`。起票 = GitHub issue cscartjp/even-app-one#30。Phase 1 の `/v1/ask`・session・`paginateForG2`、Phase 3 の `glass/reducer.ts` は**無改変再利用**。
>
> **状態共有の確定方針（issue #30 本文を簡素化して上書き）**: 独立ストア（`useSyncExternalStore` / `hermesStore.ts`）は**不採用**。個人が Hub 経由で使うだけで不要・会話ロジックは既に `glass/reducer.ts` に抽出済みのため。採用 = **素の React lift-up**（会話 `useReducer` と presets を `App.tsx` へ持ち上げ、`AppGlasses`/`Companion` に props で配る。`useGlasses` 100ms ポーリングは無改変）。storage は hisho `glass/storage.ts` を**参考に、presets 配列分（JSON 直列化・起動時プリロード）だけ拡張**（丸ごと移植ではない）。
>
> **team_validation_mode**: `subagent`（2026-06-09。Explore×2 で even-toolkit v1.7.2 の `web/*` エクスポート実在〔`AppShell`/`NavHeader`/`Card`/`ListItem`(onDelete スワイプ削除内蔵)/`Input`/`Textarea`/`Button` 等〕、g2hermes 現状〔`useReducer`・Tailwind 未導入・`even-toolkit`/`react-router` は既存依存〕、hisho の Tailwind 構成と `storage.ts` を一次照合。設計の食い違い 2 点〔外部ストア / storage 移植〕をユーザー判断で確定）。
>
> **lint/format baseline**: TS = biome（既存）。UI 実装の前に Task 2.1 で Tailwind v4 スタイル基盤を先行設置。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | コンパニオン スタイル基盤（hisho 踏襲）: g2hermes に `tailwindcss` + `@tailwindcss/vite`（devDeps）追加、`vite.config.ts` に `@tailwindcss/vite` プラグイン、`src/app.css` 新設（`@import "tailwindcss"` + toolkit `theme-light`/`typography`/`utilities` + `@source` 走査 + `@theme` + `#root max-width:430px`）、`main.tsx` で `import './app.css'`。**別の UI フレームワークは入れない**。`app.json`・network whitelist は不変 [tdd:skip:scaffold-config] | `bun run --filter g2hermes build` 成功、`biome check` 0。`App.tsx` に toolkit コンポーネントを 1 個仮置きしてシミュレーターで hisho 同等スタイル（utilities が効く）を目視。`app.json` 差分なし | - | cc:TODO |
| 2.2 | `companion/presets.ts` 純粋関数を **TDD**: 型 `Preset={id,label,text}`、`validatePreset`（label 1〜20字 / text 1〜2000字 / 空拒否）、件数 1〜8 制約、`DEFAULT_PRESETS`（現行4問シード）、`serialize`/`parse`（JSON round-trip）、不正 JSON・空文字列・検証落ち→default seed フォールバック [tdd:required] | `bun test` グリーン: 正常 round-trip / label 21字・text 2001字・空 を reject / `""`・不正 JSON・件数超過 が default seed へフォールバック。`biome check` 0 | - | cc:完了 [ceaa7ff]（**TDD**。`companion/presets.ts`＝`Preset={id,label,text}`・`validatePreset`〔型ガード＋`withinBounds`=trim非空 & 上限。label≤20/text≤2000・id非空文字列〕・`PRESET_MIN/MAX=1/8`・`DEFAULT_PRESETS`〔現行4問・id付与〕・`serialize`(JSON.stringify)/`parse`〔不正JSON・非配列・件数違反・検証落ち→`defaultSeed()`へフォールバック。**共有参照を返さずspreadコピー**で誤変更防止〕。RED→GREEN: `bun test` 21 pass〔境界1/20/21・1/2000/2001・空/空白拒否・round-trip 2/8件・空文字列/不正JSON/非配列/0件/9件/検証落ち→seed・フォールバックの非共有参照〕、全体44 pass・`biome check` 0・`bun run build` 成功。Code Reviewer 独立レビュー **APPROVE**〔境界・フォールバック網羅・共有参照非変更を確認。minor=UTF-16コードユニット計数注記のみ非ブロッキング〕。**Codex review 正規ルート（公式 openai-codex v1.0.4 / `--base 339574d --scope branch`）も不具合なし**〔検証・フォールバックがテストと整合〕） |
| 2.3 | `companion/storage.ts`（hisho 参考・配列対応分を拡張）を **TDD**: `bridge.setLocalStorage/getLocalStorage` 正本 + `waitForEvenAppBridge` 1500ms タイムアウトで dev は browser localStorage フォールバック（hisho 踏襲）+ 書き込み直列化キュー（hisho 踏襲）。キー `g2hermes.presets` に presets 配列を **JSON 文字列**で保存（全件 1 キー上書きで削除表現）。`loadPresets()`（同期プリロード用に検証通過配列 or default を返す）/ `savePresets()` [tdd:required]（bridge をモック注入） | `bun test` グリーン: bridge 有→set/get が JSON 配列を round-trip / bridge タイムアウト→localStorage フォールバックに切替 / 連続 save が直列化順序を保つ / get 失敗時 default へ。`biome check` 0 | 2.2 | cc:WIP |
| 2.4 | 状態 lift-up（**外部ストア無し**）: 会話 `useReducer` と presets を `AppGlasses.tsx` → `App.tsx` へ持ち上げ、`App` が `state`/`dispatch`/`presets` を `AppGlasses` に props で渡す。`AppGlasses` は受け取った値から `snapshotRef` を組む（`useGlasses` 100ms ポーリングは無改変）。起動時 `App` で `storage.loadPresets()` → presets 初期値。`screen.ts` idle は presets を `PRESETS` 定数でなく props 由来で列挙（「🎤 話す」と併存）[tdd:skip:integration-simulator] | 既存 `glass/reducer.test.ts` が無改変で green を維持。`bun run build` 成功・`biome check` 0。シミュレーターで現行フロー（idle↕・送信→Thinking→回答・音声メニュー）が回帰なし、かつ保存済み presets が idle に出る（実機はユーザー） | 2.2, 2.3 | cc:TODO |
| 2.5 | A 保存プリセット編集 UI（`even-toolkit/web`・hisho 踏襲）: `companion/Companion.tsx`（`AppShell`+`NavHeader`+`ScreenHeader`/`SectionHeader`）と `companion/PresetEditor.tsx`（リスト=`Card`+`ListItem`〔`onDelete` スワイプ削除〕、ラベル=`Input`、プロンプト=`Textarea`、追加/並べ替え up/down=`Button`）。編集→`setPresets`→`storage.savePresets`（write-through）。`App.tsx` が `<Companion/>` を描画（`<AppGlasses/>` 据え置き）[tdd:required]（編集ハンドラ＝追加/更新/削除/並べ替え/検証反映 をピュア関数化して unit） | `bun test` グリーン（編集ハンドラ unit: 追加・更新・削除・並べ替え・検証 reject）。`bun run build` 成功・`biome check` 0。シミュレーターでスマホ UI に CRUD+並べ替えが表示・操作でき、保存が idle へ反映（実機の再起動永続はユーザー） | 2.1, 2.4 | cc:TODO |
| 2.6 | B その場送信 UI + 既存 ask 共有: `companion/AskBox.tsx`（`Textarea`+送信 `Button`）→ `App` の ask 起動（reducer に `ASK` dispatch、label=`(カスタム)`）を呼ぶ。回答は同一 `state` を購読し `Card` で「送信中…/回答/エラー」をミラー表示（**新経路を作らず Phase 1 の `askBridge` 経由**）[tdd:required]（ask 遷移 reducer/配線を `askBridge` モックで idle→thinking→answer/error 検証） | `bun test` グリーン（送信→thinking→answer / 失敗→error の遷移）。`bun run build` 成功・`biome check` 0。シミュレーターでスマホから送信→グラスに Thinking→回答、スマホにミラー表示（実機はユーザー） | 2.4 | cc:TODO |
| 2.7 | シミュレーター E2E（A/B 通し）+ パッケージング判断。A: スマホで CRUD→idle 反映、B: スマホ送信→グラス回答→スマホミラー。`app.json` whitelist 不変・新権限なしを確認。実機最終確認・`evenhub pack`（version bump 含む）はユーザー判断 [tdd:skip:integration-e2e] | シミュレーターで A（CRUD+並べ替え+idle 反映）と B（送信→回答→ミラー）を通しで確認、console エラー0。`bun test` 全 green・`biome check` 0・`bun run build` 成功。`git diff apps/g2hermes/app.json` が空（whitelist/権限 不変）。実機・pack はユーザー | 2.5, 2.6 | cc:TODO |

### Phase 2 スコープ外（YAGNI）

- 独立ストア / `useSyncExternalStore` / `hermesStore.ts`（不採用確定）。
- アカウント / クラウド同期、複数会話セッション、プリセットのカテゴリ分け、ドラッグ&ドロップ並べ替え。
- グラス側での質問編集（キーボード無し前提を維持）。
- Bridge サーバーアドレスのランタイム設定（whitelist はネイティブ強制の静的マニフェストのため原理的に不可。`docs/guides/06-networking.md`）。

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
| 3.2.2 | `GET /health` 拡張: STT 到達性 `stt` フィールド追加 [tdd:required] | fetchImpl モックで stt 200→reachable / ECONNREFUSED→unreachable に切り替わる inject テスト。biome 0 | 3.2.1 | cc:完了（`checkStt`〔`checkHermes` と対称・STT `/health` を叩き例外を投げず reachable/unreachable/timeout/error:NNN を返す〕を `stt-client.ts` に追加。`/health` は `Promise.all` で hermes/stt を**並行確認**し独立判定→`{ ok, version, hermes, stt }`。TDD: inject 2本〔stt 200→reachable / STT のみ ECONNREFUSED→unreachable かつ hermes は reachable のまま独立〕を RED→GREEN。`bun test` 42 pass・biome 0・build OK。README ルート表に `stt` 反映） |

### Phase 3.3: クライアント音声キャプチャ（even-toolkit 流用）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.3.1 | even-toolkit/stt の export 実体確認（`GlassBridgeSource` / `createAudioBuffer` / `float32ToWav` の正確な名・signature）。`bun install` 済みで `even-toolkit/stt` が解決することを確認。無ければ自前 WAV エンコーダ（44byte header + Int16）方針を確定 [tdd:skip:investigation] | 正確な export 名・引数を設計ノート（spec §9-1）に記録。解決不能なら自前エンコーダ方針を記録 | - | cc:完了 [2e9baac]（even-toolkit **v1.7.2** の `dist/stt/*.d.ts` を直読し spec §9.1 に記録。`even-toolkit/stt` サブパス解決OK。`GlassBridgeSource`=**class**（`new`・`window.__evenBridge` 自動検出・16000Hz・`onAudioData(cb:(pcm:Float32Array,sampleRate:number))`）/ `createAudioBuffer(config?)`=factory（`getWav()`→**WAV Blob**）/ `float32ToWav(data,sampleRate)`→**Blob**。**自前エンコーダ不要**と確定。3.3.2 は WAV Blob を `fetch` body 直渡し＋`Content-Type:audio/wav` 明示） |
| 3.3.2 | 音声キャプチャ + WAV化 + POST: `bridgeClient` に `transcribe()` 追加、`AbortController`、最大30s タイマー、停止/終了/`beforeunload` で `source.stop()`（`audioControl(false)`）。空/極短録音はクライアント閾値で弾き recording へ戻す [tdd:required] | PCM→WAV ユニット（無音/最大長/通常）green、空/極短を弾く判定のユニット green、biome 0、build 成功 | 3.2.1, 3.3.1 | cc:完了（**TDD**。pure 関数を `audio/capture.ts` に集約=`concatChunks`/`isTooShort`（閾値 500ms=8000サンプル未満を弾く）/`encodeWav`（`even-toolkit/stt/audio` の `float32ToWav` 流用＝**window 非依存サブパスなので bun でテスト可**・index は window 参照で不可と実証）。`bun test` 10 pass〔PCM→WAV 無音/最大長30s/通常 + 空/極短判定〕。WebView 専用の `even/mic-source.ts`＝`GlassBridgeSource` ラップ（`useGlasses` が `window.__evenBridge` 設定→`start()`/`onAudioData`→`stop()` で `audioControl(false)`、30s 自動停止タイマー、`beforeunload` で必ずマイク閉、`dispose()` で listeners クリア）。`bridgeClient.transcribe()`＝`/v1/transcribe` へ WAV Blob を POST（Bearer・`Content-Type:audio/wav` 明示・`AbortController` 70s〔Bridge STT 60s 超過用〕・askBridge 同様 throw しない）。mic-source/transcribe は WebView/integration ＝ 実機 E2E（3.5.1）検証。`bun test` 10 pass・`biome check` 0・`bun run build` 成功） |

### Phase 3.4: 状態機械 + 権限

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.4.1 | `app.json` に `g2-microphone` 権限追加（`desc` は審査向け文言＝spec §4.6）。network whitelist は不変 [tdd:skip:config] | `app.json` に `g2-microphone` と desc 文言が実在、evenhub-cli で valid、network whitelist 不変 | - | cc:完了（PR #27 で `g2-microphone`+desc 追加済み・network whitelist 不変・`evenhub pack` valid。3.0 実機検証もこの権限で通過） |
| 3.4.2 | 状態機械拡張 `idle→recording→transcribing→review→thinking→answer` + `screen.ts` action（録音開始/停止/送信/録り直し）、idle にプリセット併存、error 表示。**recording 中 background→foreground で `audioControl` が閉じ/復帰**（`everything-evenhub:background-state`）。recording 表示は静的 or 更新 ≤1s で BLE 過負荷回避 [tdd:required]（reducer ユニット。シミュレーター部分は integration） | 状態遷移 reducer ユニット green。シミュレーターで状態遷移とモック PCM の配線確認（実音声は 3.5.1）。background→foreground でマイクが閉じ/復帰する確認。biome 0、build 成功 | 3.3.2, 3.4.1 | cc:完了（**TDD**。pure reducer を `glass/reducer.ts` に抽出＝`State`/`Event`/`reduce`/`initialState`。`bun test` 13 pass〔idle→recording→transcribing→review→thinking→answer 全遷移 + REC_TOO_SHORT + ページ循環 + FAIL + BACK リセット + プリセット併存〕。`screen.ts` は probe を撤去し新 phase の display/action（idle 先頭に `🎤 話す`＋プリセット併存、recording=静的「REC ●」で BLE 過負荷回避、transcribing/review、review でタップ送信/ダブルタップ録り直し）。`AppGlasses.tsx` を useReducer 化し副作用配線＝マイク開閉を 1 本の promise chain で直列化（probe 踏襲）、世代トークン+`recordingActiveRef` で二重停止（タップ+30s 同時）レースを排除、空/極短/空文字起こしは録り直しへ。**background/foreground**: SDK 0.0.10 は `setBackgroundState`/`onBackgroundRestore` 非提供のため `even/lifecycle.ts` で `sysEvent.eventType`（`FOREGROUND_ENTER=4`/`EXIT=5`・SDK 直購読）を監視し、recording 中は背面でマイク閉・前面で開き直す。Task 3.0 の `mic-probe.ts` は本状態機械で置換し撤去。`bun test` 23 pass・`biome check` 0・`bun run build` 成功。**シミュレーター/実機の状態遷移・モック PCM 配線・background→foreground マイク開閉の実動作確認はマイクが実機専用〔Task 3.0「シミュレーター不可」確定〕のため Task 3.5.1 実機 E2E で確認**） |

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

### マーカー凡例

| マーカー | 意味 |
|---------|------|
| `cc:TODO` | 未着手 |
| `cc:WIP` | 作業中 |
| `cc:完了` | Worker 作業完了 |
| `blocked` | ブロック中（理由を必ず記載） |

### Notes

- Created via: harness-plan create（サブエージェント検証付き・Phase 0/1/3 = 2026-06-08、Phase 2 = 2026-06-09）
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`（+ サブ spec `docs/spec/g2-hermes-phase3-voice.md` / `docs/spec/g2-hermes-companion-custom-questions.md`）、task ledger = 本 `Plans.md`
- 完了 Phase のアーカイブ: `docs/plans/g2-hermes-bridge-phase0-1.md`（Phase 0 / Phase 1）
