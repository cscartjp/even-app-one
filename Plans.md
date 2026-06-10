# G2 Hermes Bridge Plans.md

作成日: 2026-06-08 / 最終更新: 2026-06-10

Even G2 から Mac 上の Hermes Agent へ問い合わせるブリッジ。テキスト PoC（Phase 1）→ コンパニオン カスタム質問（Phase 2）→ 音声入力（Phase 3）→ 待ち時間 UX（Phase 4）と段階的に拡張中。

- **product contract（正本）**: `docs/spec/g2-hermes-bridge.md`（デスクトップ仕様書を 2026-06-08 にリポジトリへ取り込み）
- **サブ spec**: `docs/spec/g2-hermes-companion-custom-questions.md`（Phase 2）/ `docs/spec/g2-hermes-phase3-voice.md`（Phase 3）/ `docs/spec/g2-hermes-waiting-spinner.md`（Phase 4・issue #36）/ `docs/spec/g2-hermes-tts-probe.md`（Phase 7・TTS 実機プローブ）
- **precedence**: `g2-hermes-bridge.md` > 各サブ spec > 本 `Plans.md`

> 関連: 過去の経緯は memory `hisho-train-app-design` / `g2-sideload-workflow` / `reference_hub_dev_mode` / `stt-mac-b-mlx-whisper` / `g2-hermes-bridge-progress`。
> **アーカイブ**:
> - Phase 0（足場）/ Phase 1（テキスト Bridge PoC）= 全タスク完了 → `docs/plans/g2-hermes-bridge-phase0-1.md`
> - Phase 2 / Phase 3 の**完了済みタスクの詳細**（検証メモ・Codex review 結果）= `docs/plans/g2-hermes-phase2-3.md`（未完了の tail タスク 2.7 / 3.5.1 は本ファイルに残す）

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

- **モノレポ構成**: ルート `package.json` の `workspaces` = `["apps/*", "servers/*"]`。
- **G2 クライアント**: 既存 `apps/hisho` と同じ **even-toolkit + Vite + TS + React** で統一（生 SDK は使わない）。
- **秘密情報の境界**: Hermes API Key は Mac の `.env` のみ。WebView には Bridge Token（弱い秘密）だけ。
- **デプロイ・トポロジ（構成 B-1）**: Bridge と Hermes は同一 Mac（Mac B）に同居。phone→Bridge は Mac B の Tailscale IP（`http://<MacB-Tailscale-IP>:8787`）、Bridge→Hermes は loopback（`http://127.0.0.1:8642/v1`）。`app.json` whitelist は placeholder（`100.64.0.1`）を commit し `evenhub pack` 前にローカルで実 Tailscale IP に置換。STT サイドカーは Mac B に launchd 常駐（`com.frogman.g2hermes-stt`）。

---

## 検証で確定したリスク（必ず DoD へ反映）

サブエージェント検証（2026-06-08・一次情報照合）で判明した PoC が詰まる3大ポイント:

1. **認証 preHandler が CORS preflight を壊す**: OPTIONS と `/health` を認証スキップ対象にし、preflight が 200/204 を返すことを検証。
2. **タイムアウト欠如 × Hermes の長尺応答**: G2→Bridge / Bridge→Hermes 両方の `fetch` に `AbortController` タイムアウト + 超過時の G2 表示。
3. **WebView の実 Origin 未確認**: 実機 Origin は `http://127.0.0.1:<ランダムポート>`（Phase 1 で採取確定）。

> **ネットワークは Tailscale 限定**: LAN IP は実機で固まる既知問題のため使わない（memory `g2-sideload-workflow`）。Tailscale は WireGuard で暗号化するため Phase 1 の HTTP 平文リスクを緩和。

---

## Phase 0 / Phase 1（完了・アーカイブ済み）

足場（workspaces 拡張 / Bridge 雛形 / G2 クライアント雛形）と テキスト Bridge PoC（Hermes 契約 smoke / ピュア関数 TDD / Bridge ルート / G2 クライアント / 実機 E2E + v0.1.0）は**全タスク `cc:完了`**。詳細は **`docs/plans/g2-hermes-bridge-phase0-1.md`**。

## Phase 2: コンパニオン カスタム質問（issue #30）

> Spec delta: `docs/spec/g2-hermes-companion-custom-questions.md`。状態共有 = 素の React lift-up（外部ストア不採用）。team_validation_mode: `subagent`。**完了タスクの詳細記録は `docs/plans/g2-hermes-phase2-3.md`**。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | コンパニオン スタイル基盤（Tailwind v4・hisho 踏襲） | build 成功・biome 0・app.json 不変 | - | cc:完了 [0045cba] |
| 2.2 | `companion/presets.ts` 純粋関数 TDD（validate / serialize / parse / DEFAULT） | bun test green・biome 0 | - | cc:完了 [ceaa7ff] |
| 2.3 | `companion/storage.ts` TDD（bridge/localStorage フォールバック・直列化キュー） | bun test green・biome 0 | 2.2 | cc:完了 [4582ae8] |
| 2.4 | 状態 lift-up（外部ストア無し・App が useReducer+presets 保持） | reducer.test 無改変 green・build 成功 | 2.2, 2.3 | cc:完了 [430b8ce] |
| 2.5 | A 保存プリセット編集 UI（editor.ts TDD + Companion/PresetEditor） | bun test green・build 成功・シミュレーター CRUD | 2.1, 2.4 | cc:完了 [2bbfd27] |
| 2.6 | B その場送信 UI + ask 共有（ask.ts 抽出・AskBox ミラー・READY_PHASES ガード） | bun test green（送信→thinking→answer）・build 成功 | 2.4 | cc:完了 [342c771] |
| 2.7 | シミュレーター E2E（A/B 通し）+ パッケージング判断。実機最終確認・`evenhub pack` はユーザー [tdd:skip:integration-e2e] | シミュレーターで A（CRUD+並べ替え+idle 反映）と B（送信→回答→ミラー）通し・console エラー0。`bun test` 全 green・biome 0・build 成功・`git diff apps/g2hermes/app.json` 空 | 2.5, 2.6 | cc:TODO |

## Phase 3: 音声入力（G2マイク → ローカル STT → Hermes）

> Spec delta: `docs/spec/g2-hermes-phase3-voice.md`。team_validation_mode: `subagent`。Phase 1 資産（`/v1/ask`・`paginateForG2`・session）は無改変再利用。**完了タスクの詳細記録は `docs/plans/g2-hermes-phase2-3.md`**。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 3.0 | 実機マイク到達性スパイク（PCM=16kHz/mono/s16le/100ms 確定） | 実機で `audioControl` OK・PCM 到達 | - | cc:完了（PR #27・v0.1.1） |
| 3.1.0 | Python サイドカー baseline（uv + ruff + pytest・`servers/g2-hermes-stt`） | ruff 0・pytest exit 0 | - | cc:完了 |
| 3.1.1 | STT サイドカー実装 TDD（stdlib http.server + mlx-whisper・127.0.0.1 bind・幻覚除去） | pytest green・loaded=true・127.0.0.1 のみ bind | 3.0, 3.1.0 | cc:完了 |
| 3.1.2 | launchd plist `com.frogman.g2hermes-stt` + repo 配置 | 常駐・kill-9→自動復帰・loopback 実証 | 3.1.1 | cc:完了（PR #31） |
| 3.2.1 | `POST /v1/transcribe`（audio/wav buffer parser・Bearer・413/502/504） | inject テスト green・biome 0・build 成功 | - | cc:完了 [6280200] |
| 3.2.2 | `GET /health` 拡張（STT 到達性 `stt` フィールド・並行確認） | inject テスト green・biome 0 | 3.2.1 | cc:完了（PR #33） |
| 3.3.1 | even-toolkit/stt export 実体確認（自前エンコーダ不要と確定） | export 名・signature を spec §9.1 に記録 | - | cc:完了 [2e9baac] |
| 3.3.2 | 音声キャプチャ + WAV化 + POST TDD（capture.ts / mic-source.ts / transcribe） | PCM→WAV / 空・極短判定 unit green・build 成功 | 3.2.1, 3.3.1 | cc:完了（PR #32） |
| 3.4.1 | `app.json` に `g2-microphone` 権限追加（whitelist 不変） | 権限実在・evenhub valid・whitelist 不変 | - | cc:完了（PR #27） |
| 3.4.2 | 状態機械拡張 TDD（reducer.ts・lifecycle.ts・background→マイク閉・recording 静的） | reducer ユニット green・build 成功 | 3.3.2, 3.4.1 | cc:完了（PR #32） |
| 3.5.1 | 実機 E2E（録音→ローカル文字起こし→確認→Hermes 回答）。レイテンシ P50/P95 実測、秘密境界確認、`.ehpk` 生成 [tdd:skip:integration-e2e] | 実機で E2E 成功。P50/P95 記録し Bridge transcribe timeout ≥ P95×2。tcpdump/ログで音声が Tailscale 外に平文流出しない・`HERMES_API_KEY` が WebView bundle/通信に出ない を各1回確認。`g2hermes.ehpk` 生成。実機はユーザー | 3.1.2, 3.2.2, 3.4.2 | cc:TODO |

## Phase 4: 待ち時間テキストスピナー（issue #36）

> **Spec delta（2026-06-09・確定）**: product contract `docs/spec/g2-hermes-bridge.md` の上に、待ち時間フェーズ（`thinking` / `transcribing`）のグラス表示にテキストスピナーを足す設計デルタを `docs/spec/g2-hermes-waiting-spinner.md` として新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > `g2-hermes-waiting-spinner.md` > 本 `Plans.md`。起票 = GitHub issue cscartjp/even-app-one#36。スコープは **`apps/g2hermes` のグラス UI のみ**（Bridge / STT / コンパニオンは無改変）。
>
> **確定方針**: `transcribing` = 流れるドット（`●────`→`────●` ループ）、`thinking` = 8 方向矢印（`▲◥▶◢▼◣◀◤`・45°刻み）、`recording` = 静的 `REC ●` 据え置き（BLE 過負荷回避）。グリフは公式グリフ表で収録確認済み。フォールバックは線スピナー `│╱─╲`。
>
> **team_validation_mode**: `manual-pass`（2026-06-09。issue 本文＋コメントが subagent 調査 + Codex グリフ収録検証を内包。本計画化にあたり現コードと even-toolkit 内部を一次照合: ① `reducer.ts` は純関数で `frame` 未導入・`BACK→initialState` テスト在り〔`State` への `frame` 追加でフィクスチャ更新要〕、② `screen.ts` に transcribing/thinking/recording 分岐が実在、③ `AppGlasses.tsx` は `state`/`dispatch` props + `snapshotRef={...state,presets}` + 100ms ポーリング再描画、④ flicker-free 経路 `useGlasses.ts:107-110`→`bridge.ts:413-416`〔`updateHomeText`→`textContainerUpgrade`〕を実ファイルで確認。本アプリは画像 0・home 固定で経路に乗る。設計の load-bearing な主張はすべて現状コードと一致）。
>
> **lint/format baseline**: TS = biome（既存・設置済み）。新規設置不要。
> **前提**: Phase 3 の状態機械（`glass/reducer.ts` の `Phase`・`screen.ts` の display 分岐）が稼働中。

### 設計（3 点の変更）

1. **`reducer.ts`**: `State` に `frame:number` 追加、`TICK` イベントで `+1`、フェーズ入場（`STOP_RECORDING`→transcribing / `ASK`→thinking）で `frame=0` リセット。純関数維持。
2. **`AppGlasses.tsx`**: `phase ∈ {thinking, transcribing}` の間だけ `setInterval(~180–200ms)` で `TICK` dispatch、フェーズ離脱で `clearInterval`（`useEffect` 依存 `state.phase`）。
3. **`screen.ts`**: transcribing/thinking 分岐でスピナー文字を `frame % glyphs.length` で行末に出す（recording は無改変）。

安全性: `useGlasses` の `textBusy`+`pending` コアレスで BLE が詰まれば自動間引き。非等幅対策はスピナーを行末・流れるドットは専用 1 行。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 4.1 | グリフ先行検証スパイク。シミュレーターで `▲◥▶◢▼◣◀◤` / `●─` / フォールバック `│╱─╲` の実描画をテキスト出力 + スクショで確認（`test-with-simulator` / `simulator-automation`）[tdd:skip:throwaway-spike] | 8 方向矢印と流れるドットがシミュレーターで滲まず描画されることをスクショで確認。矢印が滲む/出ない→線スピナー `│╱─╲` にフォールバック決定、流れるドットの横揺れが目立つ→ドット数削減/固定幅化を決定。判断を本 Phase に追記 | - | cc:完了（実機目視 PASS・矢印滲まず＝線スピナー fallback 不採用で確定） |
| 4.2 | `reducer.ts` に `frame` + `TICK` を TDD で追加。`State.frame:number`、`TICK`→`frame+1`、`STOP_RECORDING`/`ASK` で `frame=0` リセット。`reducer.test.ts` に TICK テスト追加 + `State` 追加に伴う既存フィクスチャ更新 [tdd:required] | `bun test` green: TICK で frame 増加 / 他 state（phase/pages/transcript 等）不変 / transcribing・thinking 入場で frame=0 / 既存遷移テスト（`BACK→initialState` 含む）green 維持。`biome check` 0 | - | cc:完了 [f99fdd3] |
| 4.3 | `screen.ts` の transcribing / thinking 分岐にスピナー文字（`frame % glyphs.length`・行末）。transcribing=流れるドット、thinking=8 方向矢印（4.1 で滲めばフォールバック）、recording=静的 `REC ●` 無改変。display は純関数なので frame→glyph を unit テスト [tdd:required] | `bun test` green: transcribing が frame で流れるドット位置を返す / thinking が frame で 8 方向矢印を返す / recording が静的 `REC ●` のまま（無改変回帰）。`biome check` 0・`bun run build` 成功 | 4.1, 4.2 | cc:完了 [f99fdd3] |
| 4.4 | `AppGlasses.tsx` で `phase ∈ {thinking, transcribing}` の間だけ `setInterval(~180–200ms)` で `TICK` dispatch、離脱で `clearInterval`（`useEffect` 依存 `state.phase`）。thinking→answer/error・transcribing→review/error・BACK・unmount で確実に停止 [tdd:skip:integration-effect] | `bun run build` 成功・`biome check` 0。`useEffect` クリーンアップで `clearInterval` が全離脱経路で発火（コードレビューで確認）。ちらつき無し経路維持＝`updateHomeText`→`textContainerUpgrade` に乗り `rebuildPageContainer` に落ちない（画像 0・home 固定を崩さない） | 4.2, 4.3 | cc:完了 [f99fdd3] |
| 4.5 | シミュレーター/実機 E2E + パッケージング判断。シミュレーターで thinking の回転を目視（transcribing は実機マイク経路のため実機で）。フェーズ抜けで停止・ちらつき無しを確認。version bump + `evenhub pack` + 実機最終確認はユーザー [tdd:skip:integration-e2e] | シミュレーターで thinking スピナー回転 + フェーズ抜けで停止 + ちらつき無しを目視、console エラー0。`bun test` 全 green・`biome check` 0・`bun run build` 成功。transcribing アニメ・version bump・pack はユーザー（実機） | 4.4 | cc:完了（v0.2.3 bump+pack 済 PR#43・実機で thinking 回転 & 文字起こし中バー動作をユーザー確認） |

> **実装メモ（2026-06-09・f99fdd3）**: コア 4.2/4.3/4.4 を TDD で実装・コミット済（bun test 95 pass・biome 0・build 成功・app.json 不変）。glyph は確定方針どおり `thinking`=8 方向矢印・`transcribing`=流れるドット（●幅5）を採用。グリフ収録は Codex 検証済み。**Phase 4 完了（2026-06-09）**: v0.2.3 へ bump + `g2hermes-v0.2.3.ehpk` 生成（PR #43 `d43c460`）、**実機でユーザーが thinking の 8 方向矢印回転と文字起こし中の流れるバーを確認・矢印は滲まず**＝線スピナー `│╱─╲` への fallback は不採用で確定（4.1/4.5 とも cc:完了）。recording は設計どおり静的 `REC ●`（アニメ無し・BLE 負荷回避）。

### Phase 4 スコープ外（YAGNI）

- `recording` のアニメ化（BLE 過負荷で不採用）。
- 画像ベースのスピナー（BLE fps 不足で不採用）。
- 1 行に両スタイル併記（情報過多）。
- streaming 途中字幕・TTS・Bridge / STT / コンパニオンの変更。

### Phase 4 プロセス

ブランチを切る → PR 前に Codex Review（`/codex:review` 正規ルート）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。

---

## Phase 5: Hisho バージョン表示（issue #44）

> **Hisho ワークストリーム**（`apps/hisho`・G2 Hermes とは別アプリ）。詳細計画・公式スキル根拠 = `docs/plans/hisho-cards-version.md`。
> **version 源 = `apps/hisho/app.json` の `version`（=0.1.7）**（`package.json` の 1.0.0 はアプリ版ではない）。⚠️ `apps/hisho` に `vite.config.ts` と `vite.config.js` が両在＝Vite は `.js` 優先なので define は実体側に入れる。
> team_validation_mode: `manual-pass`（`everything-evenhub:sdk-reference` / `glasses-ui` で裏付け）。Spec skip reason: UI 局所変更・Hisho UI 正本は `design-mock.html`。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 5.1 | 使われている vite config を特定（`.ts`/`.js` 両在・Vite は `.js` 優先）、その config で `app.json` の `version`（=0.1.7）を読み `define` に `__APP_VERSION__` 注入 + `tsc -b` 用 global 宣言（`vite-env.d.ts` 等に `declare const __APP_VERSION__: string`） [tdd:skip:build-config] | `__APP_VERSION__` が `app.json` の version で注入され `tsc -b` エラー 0 | - | cc:完了 [7b2876f] |
| 5.2 | `apps/hisho/src/glass/shared.ts` の `statusBarLines()` を `HISHO v${__APP_VERSION__}` に（案A）。`justifyToBarWidth` で 540px に収まり時計が押し出されない確認、収まらねば案B（meta 行に控えめ併記）にフォールバック [tdd:required] | `statusBarLines` 出力に version を含むテスト green・`getTextWidth` 実幅で時計が欠けない | 5.1 | cc:完了 [3114b63]（案A 採用・最大時計でも左に余裕／案B 不要） |
| 5.3 | 検証 + プレビュー。`bun test` green / `bun run check` 0 / `bun run build` 成功。`bun run preview:screens`（`index.html`）or シミュレーターで version 表示をスクショ確認 [tdd:skip:verify] | 3 コマンド green + version が見えるスクショ | 5.2 | cc:完了 [508e289]（3 コマンド green・headless スクショで「HISHO v0.1.7」+ 時計併記確認） |

**Phase 5 プロセス**: ブランチ `feat/hisho-version-display` → Codex Review → PR → bot レビューループ → squash merge。

## Phase 6: Hisho ホームのカード化（issue #37・Stage A=Go 済み）

> **Hisho ワークストリーム**。Stage A（モック見た目ゲート）は Go 済み（`apps/hisho/preview/design-mock-card-spike.html`・issue #37 コメント）。詳細計画 = `docs/plans/hisho-cards-version.md`。
> **【公式仕様で確定】ネイティブ枠は SDK 標準**（`everything-evenhub:sdk-reference`）: `TextContainerProperty`/`ListContainerProperty` が `borderWidth`(0–5)/`borderColor`(0–15)/`borderRadius`(0–10・角丸)/`paddingLength`(0–32) を持つ。**枠の変更は `rebuildPageContainer`＝ちらつき**（`textContainerUpgrade` はコンテンツのみ無ちらつき）→ 無ちらつき選択は list の `isItemSelectBorderEn` か content カーソル。統合は raw SDK 直叩き（推奨）か even-toolkit `setBorder()`（高レベル `line()` は `borderWidth:0` ハードコードで不可）。
> team_validation_mode: `manual-pass`（公式スキル sdk-reference / glasses-ui / design-guidelines で裏付け）。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 6.1 | **Stage B（見え方確認＋統合経路の確定）**: raw SDK 直叩き（推奨）か even-toolkit `setBorder()` で border 付きコンテナを最小構成、シミュレーターでスクショ（`everything-evenhub:test-with-simulator` / `simulator-automation`） [tdd:skip:spike-integration] | 角丸枠の見え方をスクショ確認 + 採用経路（raw SDK / sdk-wrapper）を記録。割に合わなければ wiki「線と枠の描画」に記録して #37 クローズ | - | cc:完了（採用経路=raw SDK 直叩き・シミュレーターで角丸枠 PASS・ユーザー Go） |
| 6.2 | 採用経路で **Hisho ホームをカード化**（「電車情報」「グルメ情報」を `borderWidth>0`/`borderRadius`/`paddingLength` 付き text コンテナに）。box-drawing（`train.ts`/`shared.ts`）無改変。**選択表現は (a) list コンテナ化して `isItemSelectBorderEn`（無ちらつき）か (b) 静的枠＋content カーソル/反転**（border トグルの毎回 rebuild は避ける） [tdd:required] | ホームがカード描画・選択ロジックのテスト green | 6.1 | cc:完了（案b 採用＝静的角丸枠＋▶ content カーソル・`useHishoGlasses` ドライバ・homeCards 8 test green） |
| 6.3 | 検証: 10 行・幅に収まる / box-drawing と共存 / 選択移動で不要な全画面ちらつき無し をシミュレータースクショ（`test-with-simulator`）。`bun test` green / `bun run check` 0 / `bun run build` 成功 [tdd:skip:verify] | 3 条件のスクショ + 3 コマンド green | 6.2 | cc:完了（シミュレーターで home/電車/グルメ/近隣split/駅選択 全遷移 PASS・console 0・3 コマンド green） |
| 6.4 | 結論を wiki concept「線と枠の描画」に反映。採用なら正本モック `design-mock.html` への反映は**別途ユーザー承認後**（保護ファイル） [tdd:skip:docs] | wiki 更新 + #37 最終結論コメント | 6.3 | cc:TODO（merge 後に wiki 反映 + #37 結論コメント・正本モック反映は別途承認） |

**Phase 6 プロセス**: ブランチ `feat/hisho-home-cards` → Codex Review → PR → bot レビューループ → squash merge。

> **実装メモ（2026-06-10・6.1〜6.3 完了）**: 採用経路 = **raw SDK 直叩き**（even-toolkit `useGlasses` のホームは単一テキストコンテナ方式で border 付き複数コンテナの注入 hook が無いため）。6.1 スパイクでシミュレーターの角丸枠描画を確認しユーザー Go。本実装（6.2）は **Hisho 専用ドライバ `useHishoGlasses.ts`** を新設し、ホーム/テキスト画面を raw SDK（`rebuildPageContainer`＋無ちらつき `textContainerUpgrade`）で描画、**split（gourmetNearby）の精密 3 ペインは既存 `EvenHubBridge.show/updateSplitPage` をそのまま再利用**（書き直さず・二重 createStartUp 回避のため init で `showTextPage` を 1 回消化）。入力（`onGlassAction`）・events・shutdown は無改変。ホームは `homeCards.ts`（ピュア・8 test green）で「ステータスバー(version+時計)＋最寄駅＋電車カード＋グルメカード＋ヒント」を構成。**選択は案 b＝静的角丸枠＋▶ content カーソル**（`isItemSelectBorderEn` は list 化が必要で分離カードを失うため不採用・枠トグル rebuild も不採用＝無ちらつき）。box-drawing（`train.ts`/`shared.ts`）無改変・`apps/hisho` 限定（g2hermes / even-toolkit 無改変）。検証（6.3）= シミュレーターで home(カード)/電車/グルメ/グルメ近隣(split)/駅選択の全遷移・選択移動・戻るを目視 PASS（console エラー 0）、`bun test` 11 pass・`biome check` 0・`bun run build` 成功。次: Codex Review → PR → bot ループ → squash merge。6.4（wiki 反映＋#37 結論コメント・正本モック反映）は merge 後＋別途承認。

## Phase 7: TTS 実機プローブ（音声応答の実装可否を実機で確定）

> **G2 Hermes ワークストリーム**（`apps/g2hermes` のみ。Bridge / STT / コンパニオン / `apps/hisho` は無改変）。
> Spec delta: `docs/spec/g2-hermes-tts-probe.md` を新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > `g2-hermes-tts-probe.md` > 本 `Plans.md`。
> **目的**: 回答テキストの音声読み上げ（方式1 Web Speech API が本命 / 方式2-3 は MP3）の実装可否を、**ユーザー実機 iPhone で前面/背面の鳴動可否**として確定する。本実装ではなく feasibility probe。
> **確定事実（調査済み・2026-06-11）**: WebView=Flutter（iOS=WKWebView）。Android System WebView は `speechSynthesis` 非対応（方式1は実質 iPhone 専用）。WKWebView は**背面化・画面ロックで音声停止**の既知バグ（方式1/2/3 共通の壁）。iOS は**初回 speak() に user activation を要求**する版あり。→ 机上断定不能、実機プローブで決める。
> **Skeptic 反映**: 前面で鳴らない場合に「ジェスチャ制約」か「背面suspend」かを弁別するため、**自動発話（回答後タップ無し）と ジェスチャ発話（タップ/CLICK 起点）の両方を測る**。
> **非破壊の核**: プローブは `VITE_TTS_PROBE`（既定 OFF）でのみ有効。OFF 時 `ask.ts` はバイト等価（フック完全 no-op）。**ネットワークは増やさない**（on-device TTS + data-URI のみ・whitelist/CORS 変更なし）。
> team_validation_mode: `manual-pass`（`everything-evenhub:sdk-reference` で WebView=Flutter を確認・Web 一次情報を複数ソースでクロスチェック・コードベースは Explore サブエージェントで地図化・memory `g2-hermes-bridge-progress` 参照）。Product/Architecture/Security/QA/Skeptic を単独で分けて評価済。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 7.0 | プローブ足場: `app.json` version 0.2.6→0.2.7、`VITE_TTS_PROBE` フラグを `vite-env.d.ts` の `ImportMetaEnv` に追加（既定 OFF・Vite が `VITE_` env を `import.meta.env` に自動注入するため `define` 不要）。sub-spec は作成済 [tdd:skip:build-config] | `tsc -b` エラー 0・`bun run build` 成功・`git diff app.json` が version のみ・フラグ未設定時 `import.meta.env.VITE_TTS_PROBE` が falsy | - | cc:完了 |
| 7.1 | ピュア probe コア `apps/g2hermes/src/audio/ttsProbe.ts`: capability 検出（`'speechSynthesis' in window` / `getVoices()` を `voiceschanged` で settle し ja-JP 有無）、verdict→グラス1行整形（例 `🔊spk=Y aud=N v=3`）、gate 判定（`VITE_TTS_PROBE` falsy なら何もしない）。`window.speechSynthesis` を mock してテスト [tdd:required] | capability 整形・verdict 整形・gate のユニットテスト green（mock で voices 0件/ja有/未対応の3系統）・副作用 import なし | 7.0 | cc:TODO |
| 7.2 | `ask.ts` への最小フック: `ANSWERED` dispatch 直前にプローブ呼び出し。**フラグ OFF で完全 no-op（既存テスト不変・dispatch 列が等価）**。ON のとき verdict 1 行を回答 pages 末尾に追記してグラス表示 [tdd:required] | フラグ OFF で `runAsk` の dispatch（ASK→ANSWERED）が現行と等価なテスト green・ON で pages 末尾に verdict 行が付くテスト green・`biome check` 0 | 7.1 | cc:TODO |
| 7.3 | 実発話ランナー（device-io）: `SpeechSynthesisUtterance`(lang ja-JP) の `speak()` と data-URI 短音の `new Audio().play()` を実行し、`onerror`/promise reject を捕捉して結果を返す。**自動発話（回答後）と ジェスチャ発話（グラス CLICK / 送信タップ起点）の2経路**を用意 [tdd:skip:device-io] | ビルドに含まれ・前面で console に capability と各経路の試行結果が出る（Safari Web Inspector で確認可）・型チェック/biome 0 | 7.2 | cc:TODO |
| 7.4 | 検証 + プローブ用 `.ehpk`: `bun test` green / `biome check` 0 / `bun run build` 成功。**`.env` のある場所で `VITE_TTS_PROBE=1` でビルド → `evenhub pack`（直叩き・build→pack 順）**。bundle 検証: 実 BASE 値・version 0.2.7 を `rg` でヒット確認、ENV 未設定警告がログに無い [tdd:skip:verify] | 3 コマンド green + `g2hermes-tts-probe.ehpk` 生成 + bundle `rg` 検証 PASS（実 BASE 値・0.2.7） | 7.3 | cc:TODO |
| 7.5 | **実機 E2E プローブ（ユーザー実施）**: iPhone へサイドロード。matrix を取る — ②前面・自動 / ③前面・ジェスチャ / ④背面(画面ロック)・自動 × {`speechSynthesis`, `Audio`}。各セルの鳴動可否を聴覚＋グラス verdict 行で記録。前面は Safari Web Inspector で `getVoices()` も確認 [tdd:skip:integration-e2e] | 鳴動可否 matrix が記録され、方式1の go/no-go と「ジェスチャ制約 vs 背面suspend」の弁別が付く。実機はユーザー | 7.4 | cc:TODO |
| 7.6 | 結論を sub-spec / memory（`g2-hermes-bridge-progress`）に反映し、次手を分岐記録（前面OK→方式1本実装へ新 Phase / 背面必須→Even 社へネイティブ再生 API 要望） [tdd:skip:docs] | sub-spec に matrix 結果と判断・memory 更新・次 Phase の方針 1 行 | 7.5 | cc:TODO |

**Phase 7 プロセス**: ブランチ `feat/g2hermes-tts-probe` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke → Codex Review（`/codex:review`）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。プローブ `.ehpk` のサイドロードと matrix 取得はユーザー。

### Phase 7 スコープ外

- MP3 生成（Bridge）/ `audioUrl` 配信 / network whitelist 追加 / CORS（方式2-3 の本実装。プローブはネットワークを増やさない）。
- 本番読み上げ UX（停止制御・ページ同期・話速/音声選択）。
- Android 対応（System WebView が `speechSynthesis` 非対応のため方式1では原理的に不可。必要なら別途ネイティブ polyfill 検討）。

---

## 制約

- **Phase 2–4（G2 Hermes 作業）では `apps/hisho/` を改変しない**（読み取り・参照のみ）。**Phase 5–6 は Hisho ワークストリーム＝`apps/hisho/` が対象**。どの Phase でも `apps/hisho/preview/design-mock.html`（UI デザイン正本）は保護ファイルで無改変（spike はコピー `design-mock-card-spike.html` を使用・正本反映は別途承認）。
- G2 表示は実機 line height 27px・**最大10行**・576×288px・4bit 緑階調。回答は短文化（instructions + `paginateForG2`）。
- **ネットワークは Tailscale 限定**。whitelist は Mac の Tailscale IP（`http://100.x.x.x:PORT`）の full origin のみ。LAN IP は実機で固まるため使わない。
- app.json の network whitelist は CORS 回避ではない。Bridge 側で CORS ヘッダ + OPTIONS 応答が別途必要。whitelist は ポート込み full origin・wildcard/bare hostname 不可。
- 秘密情報: `HERMES_API_KEY` を WebView に出さない。Bridge Token と Hermes Key を分ける。`.env` は gitignore。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` スキルを必ず invoke すること。

### マーカー凡例

| マーカー | 意味 |
|---------|------|
| `cc:TODO` | 未着手 |
| `cc:WIP` | 作業中 |
| `cc:完了` | Worker 作業完了 |
| `blocked` | ブロック中（理由を必ず記載） |

### Notes

- Created via: harness-plan create（サブエージェント検証付き・Phase 0/1/3 = 2026-06-08、Phase 2 = 2026-06-09、Phase 4 = 2026-06-09、**Phase 5/6（Hisho・issue #44/#37）= 2026-06-10・everything-evenhub 公式スキル sdk-reference/glasses-ui/design-guidelines で裏付け**、**Phase 7（TTS 実機プローブ）= 2026-06-11・WebView=Flutter を sdk-reference で確認＋WKWebView 背面suspend/Android 非対応を Web 一次情報で複数ソース確認・Explore で差し込み点を地図化**）
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`（+ サブ spec 3 本）、task ledger = 本 `Plans.md`
- **Hisho ワークストリーム（Phase 5/6）の詳細計画・公式スキル根拠 = `docs/plans/hisho-cards-version.md`**
- アーカイブ: `docs/plans/g2-hermes-bridge-phase0-1.md`（Phase 0/1）/ `docs/plans/g2-hermes-phase2-3.md`（Phase 2/3 完了タスク詳細）
