# G2 Hermes Bridge Plans.md

作成日: 2026-06-08 / 最終更新: 2026-06-14

Even G2 から Mac 上の Hermes Agent へ問い合わせるブリッジ。テキスト PoC（Phase 1）→ コンパニオン カスタム質問（Phase 2）→ 音声入力（Phase 3）→ 待ち時間 UX（Phase 4）と段階的に拡張中。

- **product contract（正本）**: `docs/spec/g2-hermes-bridge.md`（デスクトップ仕様書を 2026-06-08 にリポジトリへ取り込み）
- **サブ spec**: `docs/spec/g2-hermes-companion-custom-questions.md`（Phase 2）/ `docs/spec/g2-hermes-phase3-voice.md`（Phase 3）/ `docs/spec/g2-hermes-waiting-spinner.md`（Phase 4・issue #36）/ `docs/spec/g2-hermes-tts-probe.md`（Phase 7・TTS 実機プローブ）/ `docs/spec/g2-hermes-voice-answer.md`（Phase 8・音声回答 本実装＝Aivis WAV + audioUrl）
- **precedence**: `g2-hermes-bridge.md` > 各サブ spec > 本 `Plans.md`

> 関連: 過去の経緯は memory `hisho-train-app-design` / `g2-sideload-workflow` / `reference_hub_dev_mode` / `stt-mac-b-mlx-whisper` / `g2-hermes-bridge-progress`。
> **アーカイブ**:
> - Phase 0（足場）/ Phase 1（テキスト Bridge PoC）= 全タスク完了 → `docs/plans/g2-hermes-bridge-phase0-1.md`
> - Phase 2 / Phase 3 の**完了済みタスクの詳細**（検証メモ・Codex review 結果）= `docs/plans/g2-hermes-phase2-3.md`（未完了の tail タスク 2.7 / 3.5.1 は本ファイルに残す）
> - Phase 4（待ち時間スピナー）/ Phase 7（TTS 実機プローブ）= 全タスク完了 → `docs/plans/g2-hermes-phase4-7-done.md`（2026-06-11 アーカイブ）
> - Phase 5（Hisho version）/ Phase 6（Hisho カード化）の詳細 = `docs/plans/hisho-cards-version.md`

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

## Phase 4: 待ち時間テキストスピナー（issue #36）— 完了・アーカイブ済み

> **全タスク `cc:完了`**（4.1〜4.5）。待ち時間フェーズ（`thinking`=8 方向矢印 / `transcribing`=流れるドット / `recording`=静的 `REC ●`）のグラス表示。v0.2.3 bump + pack 済（PR #43 `d43c460`）・実機で回転＆文字起こし中バー確認済（矢印滲まず＝線スピナー fallback 不採用）。
> 詳細（設計・task ledger・実装メモ）= **`docs/plans/g2-hermes-phase4-7-done.md`**。spec = `docs/spec/g2-hermes-waiting-spinner.md`。

---

## Phase 5: Hisho バージョン表示（issue #44）— 完了

> **Hisho ワークストリーム**。**全タスク `cc:完了`**（5.1〜5.3）。`apps/hisho/app.json` の `version` を `__APP_VERSION__` で注入し `statusBarLines()` に `HISHO v0.1.7` 表示（案A・時計併記）。
> 詳細計画・公式スキル根拠 = **`docs/plans/hisho-cards-version.md`**。

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

## Phase 7: TTS 実機プローブ（音声応答の実装可否を実機で確定）— 完了・アーカイブ済み

> **全タスク `cc:完了`**（7.0〜7.6）。`VITE_TTS_PROBE`（既定 OFF）gate の feasibility probe。**結論**: Android = go（方式2/3＝サーバ生成音声を `new Audio()` で前面・背面とも再生可）/ 方式1（Web Speech）は Android 非対応で no-go / iOS は iPhone 未所持で未判定。本線は **方式2（AivisSpeech・WAV）= Phase 8** へ。
> 詳細（task ledger・確定事実・実機 matrix）= **`docs/plans/g2-hermes-phase4-7-done.md`**。spec = `docs/spec/g2-hermes-tts-probe.md`。

---

## Phase 8: 音声回答 本実装（Aivis WAV + audioUrl）— 完了・アーカイブ済み

> **G2 Hermes ワークストリーム**（`apps/g2hermes` ＋ `servers/g2-hermes-bridge`）。**全タスク `cc:完了`**（8.0〜8.6）。ユーザー設定（音声で回答 YES/NO・既定 OFF）に応じ Hermes 回答を Aivis（`127.0.0.1:10101`・話者 888753760・WAV）で音声化し、`audioUrl=/audio/<id>`（256bit capability URL・Bearer 除外＋Range 206/416＋GET/HEAD 限定＋`no-store`）で配信、`new Audio()` で再生。設定 OFF / Aivis 障害時は**テキスト 200 + `audioUrl:null` に降格＝現行等価**。`app.json` whitelist 不変。bridge 80 + g2hermes 127 test green・v0.2.9 pack。**PR #56 マージ・実機音声鳴動 OK**（memory `g2-hermes-phase8-voice-answer-shipped`）。
> 詳細（task ledger 8.0〜8.6・Codex P2 反映・スコープ外・プロセス・team_validation）= **`docs/plans/g2hermes-phase8-uilab-phase9-done.md`**。spec = `docs/spec/g2-hermes-voice-answer.md`。

---

## Phase 9: UI Lab サンドボックス（apps/ui-lab・UI デザイン実時間試作）— 完了・アーカイブ済み

> **新規ワークストリーム**（`apps/ui-lab`。g2hermes / hisho 無改変）。**全タスク `cc:完了`**（9.0〜9.6）。グラス表示 UI を **スマホ companion で実時間に変えてグラスで見比べる**試作アプリ（枠/余白/選択4種/skeleton 3種/modal/明るさ）。気に入った数値は出力パネルから TS スニペットで移植。raw SDK 描画（`useHishoGlasses` パターン流用・約40ms デバウンス・`isEventCapture:1` ちょうど1個/テキストコンテナ ≤ 8 を不変条件化）。**権限なし**（`permissions: []`・`com.frogman.uilab`・v0.0.1）。17 test green・`ui-lab-v0.0.1.ehpk` 生成。**PR #58 マージ**（memory `ui-lab-phase9-orca-codex-wip`）。
> 詳細（task ledger 9.0〜9.6・公式プロパティレンジ・スコープ外・プロセス）= **`docs/plans/g2hermes-phase8-uilab-phase9-done.md`**。spec = `docs/spec/ui-lab-sandbox.md`。

---

## Phase 10: IMU Lab スパイク（apps/imu-lab・IMU 生値可視化 feasibility probe）— 完了

> **新規ワークストリーム**（`apps/imu-lab`。g2hermes / hisho / ui-lab は無改変）。クラウド側で起票・実装したスパイクを bot レビュー対応の上マージ（**PR #59・squash `fdf300f`・2026-06-14**）。
> Spec: `docs/spec/imu-posture-spike.md`（IMU 姿勢〔猫背〕アプリの本実装前に実機前提を埋めるスパイク契約）。precedence: 本 spike spec > 本 `Plans.md` Phase 10。
> **目的**: Even G2 の IMU（`imuData={x,y,z}` 3軸のみ・SDK `0.0.10` で確定。ジャイロ単独/6・9軸/クォータニオンはプロトコル非存在）で「歩行時の猫背（頭の前傾）検知 → 矯正リマインド」が成立するかを実機で確認する **前提確定スパイク**（本実装ではない）。
> **構成**: 主計測 UI は **スマホ companion の DOM**（`companion/ImuLab.tsx`＝数値・ログ。背面 console が読めないため）。グラスは要約のみ（`glass/screen.ts`＝タップ計測 ON/OFF・↕ pace 切替・ダブルタップ終了）。ブリッジ配線 `imu/useImu.ts`、ピッチ角・角度差は `imu/math.ts`、状態は `imu/{reducer,state}.ts`、グラス整形は `imu/glass.ts`。
> **機能**: 計測 開始/停止（`imuControl`）・pace 切替（P100/P500/P1000）・キャリブレーション（良い姿勢で `g_ref` 保存 → `g_ref` と現在ベクトルの角度差 θ をライブ表示）・振動テスト（`navigator.vibrate()` 可否の単体確認）。
> **Security**: ネットワーク無し・秘密情報無し・**IMU は無権限**（`app.json` permissions `[]`・package_id `com.frogman.imulab`・name "IMU Lab"・version `0.0.1`）。
> **team_validation_mode**: クラウド起票スパイク（ローカル UI のみ・auth/secret/network 無し）。
> **状態**: **完了**。`bun test` 30 pass / `biome check` 0 / `bun run build` 成功。bot レビュー（CodeRabbit 1 / Copilot 2）を `f80f060` で対応（① 非同期初期化の購読リーク/未処理 reject → async IIFE + try/catch + `disposed` 再チェック、② `start()` 非同期中の `stop()` 競合を `measuringRef` でガード、③ `GO_BACK` のときだけ `exit()`）。**実機で動作確認済み**・`evenhub pack` で `imu-lab-v0.0.1.ehpk` 生成（114762 bytes・bundle に version `0.0.1` HIT・ENV 依存なし）。version bump 対象外（未リリース 0.0.1）。
> **次（未起票・本実装の前提）**: 実機スパイクで matrix（`x/y/z` の素性・単位/レンジ・`ImuReportPace` 実レート安定性・各 pace の電池実消費・`navigator.vibrate()`/音の WebView 可否・装着連動 `isWearing`）を埋めてから本実装 spec を起票。

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
