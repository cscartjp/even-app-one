# G2 Hermes Bridge Plans.md

作成日: 2026-06-08 / 最終更新: 2026-06-11

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

## Phase 8: 音声回答 本実装（Aivis WAV + audioUrl 配線 + コンパニオン YES/NO 設定）

> **G2 Hermes ワークストリーム**（`apps/g2hermes` ＋ `servers/g2-hermes-bridge`。`apps/hisho` / STT / Hermes Agent の TTS 設定は無改変）。
> Spec delta: `docs/spec/g2-hermes-voice-answer.md` を新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-voice-answer.md` > 本 `Plans.md`。
> **目的**: Phase 7 で確定した「サーバ生成音声を `new Audio()` で前面・背面とも再生可（Android=go）」を受け、**Hermes 回答をユーザー設定（音声で回答 YES/NO・既定 OFF）に応じて音声でも返す**本実装。**本線=方式2（AivisSpeech・WAV をそのまま配信）**。音声生成は **G2 Bridge が Aivis Engine（`127.0.0.1:10101`・VOICEVOX 互換・既定話者 888753760・WAV 44100/mono/16bit）を直接叩く独立実装**。
> **非破壊の核**: 設定 OFF のとき ask は `tts` を付けず Bridge も TTS を走らせない＝**回答挙動は現行と等価**。Aivis 障害時も **テキスト回答は必ず 200 で返り `audioUrl:null` に降格**（500 にしない）。`app.json` whitelist は **audioUrl が同一 origin 相対のため不変**。
> **audioUrl 認証（Hermes レビュー＋Codex レビュー反映）**: `new Audio()` は Authorization を付けられないため `/audio/<id>` は Bearer スキップ。代償として **256bit random id（capability URL）＋ Range 対応（206/416）＋ GET/HEAD 限定（405）＋ `Cache-Control: no-store`＋ id ログ非露出** をセット必須で成立させる。**［Codex P2］認証除外は `/audio/` prefix 判定にする（現状の `PUBLIC_PATHS.has()` 完全一致では `/audio/<id>` が 401）。** **［Codex P2］現状 Bridge は `0.0.0.0` listen のため、bearerless `/audio` を他 IF から守るべく listen を Tailscale IF bind / firewall に締める（8.2 で要件化）。**
> **team_validation_mode**: `manual-pass`（2026-06-11。Mac B の Hermes Agent＝AivisSpeech 構成オーナーと `hermes-chat` で連携し、Aivis API 形状・話者・WAV 仕様・合成実測〔15字≈1.2s/82字≈4.4s〕・timeout 目安を一次確定。audioUrl 配信のセキュリティ〔capability URL 成立条件・Range・総byte 上限・同時実行制限・speechText=短縮版〕を Hermes が独立レビューし反映。Product/Architecture/Security/QA/Skeptic を単独で分けて評価）。
> **lint/format baseline**: TS = biome（`apps/g2hermes`・`servers/g2-hermes-bridge` とも設置済）。Bridge = bun test + Fastify + zod（既存）。新規設置不要。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 8.0 | Spec delta（docs）: 本実装の product contract `docs/spec/g2-hermes-voice-answer.md` 新設（Aivis 連携契約・request `tts` flag・response は既存 `text` 温存＋`speechText`/`audioUrl` 追加・`/audio/<id>` capability 配信・in-memory TTL キャッシュ・graceful degradation・Bridge `.env` 変数）。`g2-hermes-tts-probe.md` 7.6 を本線=方式2(Aivis) に更新。Plans ヘッダー sub-spec 一覧に追加 [tdd:skip:docs] | sub-spec 作成・precedence 明記・probe 7.6 更新・Plans 参照追加 | - | cc:完了（2026-06-11・本計画作成と同時に作成） |
| 8.1 | **Aivis クライアント** `servers/g2-hermes-bridge/src/aivis-client.ts`: `AIVIS_BASE_URL`/`AIVIS_SPEAKER_ID` 等を env から読み、`/audio_query`→`/synthesis` を叩いて WAV Buffer を返す。AbortController timeout（query 5s / synthesis 15s / 全体 20s・env 上書き可）。Aivis 未到達/timeout/非200 は **型付きエラー**で返す（呼び出し側で null 降格）。`fetch` を inject してテスト [tdd:required] | `bun test` green（query→synthesis の URL/method/body/speaker を inject mock で検証・timeout と非200 で型付きエラー・成功で WAV Buffer 返却）・`biome check` 0 | 8.0 | cc:完了 [29f6906]（aivis-client + config・5 test green） |
| 8.2 | **audio ストア + 配信ルート**: in-memory TTL キャッシュ（`Map<id,{buf,expiresAt,bytes}>`・TTL/件数/総byte 三重上限・古い順 evict・**再生後即削除しない**）＋ `GET\|HEAD /audio/:id`。id=`crypto.randomBytes(32).toString("base64url")`。**Bearer 認証除外は `/audio/` prefix 判定**（`path.startsWith('/audio/')`。**現状の `PUBLIC_PATHS.has()` 完全一致では `/audio/<id>` が 401 になる＝Codex P2**）。`Content-Type: audio/wav`・`Content-Length`・`Cache-Control: no-store, private`・`Accept-Ranges: bytes`。**Range→206+Content-Range / 不正→416**。GET/HEAD 以外 405。未知/期限切れ→404。id はログに先頭6文字のみ。**［Codex P2 多層防御］`index.ts` の listen を `0.0.0.0` から Tailscale IF bind に変更（or OS firewall で `/audio` を他 IF から遮断）** [tdd:required（route）/ bind は tdd:skip:integration] | inject テスト green（保存→GET で同一 WAV・HEAD で本文無し+ヘッダ・**Range で 206+Content-Range / 不正 Range で 416**・未知 id 404・TTL/byte 超過で evict・GET/HEAD 以外 405）・**Bearer 無しで `/audio/<動的 id>` GET が 200（prefix 除外が動的 id に効く）**・bind 変更/firewall がコードレビューで確認・`biome check` 0 | 8.0 | cc:完了 [29f6906]（audio-store/audio-range/route・prefix Bearer 除外・bind=config.bindHost・15 test green） |
| 8.3 | **ask 回答経路に TTS opt-in 配線**: request に `tts?: boolean`（zod・既定 false）。**既存 `text` フィールドは無改変で温存**し、`speechText`（任意・初期=`text` を `TTS_MAX_CHARS` で短縮）と `audioUrl` を**追加**（**`text`→`answerText` 改名はしない＝Codex P2・OFF 等価/既存テスト不変**）。`tts:true` のとき speechText→8.1 で WAV→8.2 に保存→**相対** `audioUrl=/audio/<id>` 付与。同時合成は `TTS_MAX_CONCURRENCY`(2) に制限。Aivis 失敗/timeout は **`audioUrl:null`＋200＋structured log**（id 非露出）。音声入力経路（transcribe→回答）も同 ask 経路を再利用 [tdd:required] | inject テスト green（tts:true で audioUrl 付与・tts:false で audioUrl=null かつ Aivis 未呼び出し・Aivis 失敗で audioUrl=null だが 200+text・speechText が MAX_CHARS で切詰・同時実行上限）・既存 ask/transcribe テスト不変・`biome check` 0 | 8.1, 8.2 | cc:完了 [29f6906]（tts flag・graceful null 降格・limiter・既存 44 test 不変） |
| 8.4 | **コンパニオン設定トグル「音声で回答」**: `apps/g2hermes/src/companion/settings.ts`（ピュア・`voiceAnswer:boolean` 既定 **false**・validate/serialize/parse）＋ `storage.ts` に settings 永続化（presets と別キー・bridge/localStorage フォールバック）＋ Companion に Toggle UI（even-toolkit `Toggle`）。状態 lift-up（App が settings 保持） [tdd:required] | `bun test` green（既定 OFF・往復直列化・storage 保存/復元・presets キーと非衝突）・`bun run build` 成功・`biome check` 0 | - | cc:完了 [a7f92ab]（settings.ts・共通 JSON ストア化で settings 永続化・Toggle UI・App lift-up） |
| 8.5 | **クライアント送信に設定反映 + 再生配線**: ask 送信時 `settings.voiceAnswer===true` なら request に `tts:true`（false/未設定なら付けない）。`ANSWERED` 処理で 設定 ON かつ `audioUrl` 有 なら `new Audio(<BRIDGE_BASE>+audioUrl).play()`（play() reject は握り潰してログ・回答表示は阻害しない・404 は正常系）。`app.json` 不変（whitelist 追加なし） [tdd:required（純ロジック）/ play は device-io skip] | `bun test` green（ON→request に tts:true・OFF→tts 未付与・audioUrl 無し/設定 OFF で再生呼ばない の純ロジック）・再生実発火は device-io skip・`bun run build` 成功・`biome check` 0・`git diff apps/g2hermes/app.json` 空 | 8.3, 8.4 | cc:完了 [a7f92ab]（askBridge tts 引数・playAudio・runAsk 配線・App/AppGlasses で settings→tts） |
| 8.6 | **検証 + 配布**: `bun test` 全 green / `biome check` 0 / `bun run build` 成功。Bridge ローカル起動 + 実 Aivis（127.0.0.1:10101）で「設定ON→ask `tts:true`→WAV 生成→audioUrl→ブラウザ/シミュレーターで再生」手動 E2E。設定OFF が現行等価も確認。version bump（0.2.7→0.2.9）＋ **`.env` のある場所で build→`evenhub pack`（直叩き・build→pack 順）**＋ bundle 検証（実 BASE 値・version 0.2.9 を `rg`・ENV 未設定警告なし）。実機サイドロード＋音声鳴動はユーザー [tdd:skip:integration-e2e] | 3 コマンド green + 手動で audioUrl 再生 PASS + 設定OFF 等価確認 + `g2hermes-v0.2.9.ehpk` 生成 + bundle `rg` 検証 PASS。実機鳴動はユーザー | 8.3, 8.5 | cc:完了（bridge 80 + g2hermes 127 test green・biome 0・build 成功・`.ehpk` 160KB 生成・bundle rg で実 BASE 100.88.141.39:8787 と 0.2.9 HIT・ENV 警告なし。**手動 E2E は Aivis 到達不可〔本ビルドホストから loopback/Mac B とも curl exit7〕でスキップ**＝inject テストで代替・実機鳴動はユーザー） |

### Phase 8 スコープ外（YAGNI）

- 話者/style 選択 UI（既定 `888753760` 固定）。MP3/ogg 変換（WAV で足る）。
- 読み上げ UX の作り込み（停止制御・ページ同期・話速・full 回答の自然文化・表示と読み上げの分離）。
- iOS 実機検証（iPhone 未所持・プローブ未判定）。Android 前提で実装。
- Aivis 自動起動（`open -a`）は Optional（8.1/8.3 の graceful null 降格を required とし、auto-start は env `AIVIS_AUTO_START` 既定 false の任意機能）。

### Phase 8 プロセス

ブランチ `feat/g2hermes-voice-answer` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke → Codex Review（`/codex:review` 正規ルート）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。Bridge `.env`（`AIVIS_*` 等）は gitignore・実機検証で調整。プローブ用 `.ehpk` サイドロードと音声鳴動確認はユーザー。

---

## Phase 9: UI Lab サンドボックス（apps/ui-lab・UI デザイン実時間試作）

> **新規ワークストリーム**（`apps/ui-lab`。g2hermes / hisho は無改変）。
> Spec delta: `docs/spec/ui-lab-sandbox.md` を新設。precedence: `ui-lab-sandbox.md` > 本 `Plans.md` Phase 9。
> **目的**: グラス表示（コンテナ方式）の UI を **スマホ companion のコントロールパネルで実時間に変えながらグラスで見比べる**学習・試作アプリ。枠（borderWidth/Radius/Color）・余白（padding）・選択表現（反転/▶/塗り/太枠）・骨格（list/cards/split）・明るさ＋擬似モーダル（textColor/modal/modalDim）を振れる。気に入った数値は出力パネルから TS スニペットで実アプリへ移植。
> **再利用**: `apps/hisho/src/glass/homeCards.ts`（raw SDK 角丸枠カード）/ `useHishoGlasses.ts`（raw SDK ドライバ）のパターンを流用（車輪の再発明なし）。
> **公式プロパティレンジ**（sdk-reference・Phase6 既出）: `borderWidth 0–5` / `borderRadius 0–10` / `borderColor 0–15` / `paddingLength 0–32`。
> **不変条件**: `buildContainers` が常に「`isEventCapture:1` ちょうど1個」「テキストコンテナ ≤ 8」を保証。プロパティ変更は `rebuildPageContainer`＝ちらつき → **約40msデバウンス**。
> **Security**: ネットワーク無し・秘密情報無し・**権限不要**（`app.json` permissions: `[]`）。
> **team_validation_mode**: `manual-pass`（ローカル UI のみ・auth/secret/network/billing/外部連携なし。Product/Architecture/Security/QA/Skeptic を単独評価。修正反映: 公式レンジ訂正・≤8コンテナ/単一eventCapture を不変条件化・rebuild デバウンス・scaffold 先行）。
> **lint/format baseline**: 新規アプリのため未設置 → 9.1 で biome/tsc/vite を hisho に揃えて設置（実装タスクの前提）。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 9.0 | Spec delta（docs）: `docs/spec/ui-lab-sandbox.md` 新設（DesignParams モデル・公式レンジ・specimen=単一メニュー画面・selectionStyle 4種・modal dim 意味・出力パネル契約・不変条件・権限なし）[tdd:skip:docs] | sub-spec 作成・precedence 明記・公式レンジ固定 | - | cc:完了（2026-06-12・本計画作成と同時に作成） |
| 9.1 | **scaffold + baseline**: `apps/ui-lab` を hisho と同一スタックで生成（app.json: package_id `com.frogman.uilab`・version 0.0.1・permissions `[]`、vite/tsc/biome/react-router/even-toolkit、`__APP_VERSION__` 注入、hello-world 描画）。everything-evenhub `quickstart`/`template` をベースに hisho 構成へ整合 [tdd:skip:scaffold] | `bun run build` 成功・`biome check` 0・`evenhub` で app.json valid・workspaces に認識される | - | cc:完了 |
| 9.2 | **`params/types.ts`（DesignParams + 既定値・ピュア）+ `params/storage.ts`（最後の値を永続化・bridge/localStorage フォールバック）** [tdd:required] | `bun test` green（既定値が全フィールド公式レンジ内・serialize/parse 往復・storage 保存/復元）・`biome check` 0 | 9.1 | cc:完了 |
| 9.3 | **中核 `glass/buildContainers.ts`（純粋関数 `params→CardContainerConfig[]`）**: 枠/余白/選択表現4種/skeleton(list\|cards\|split)/modal dim を表現 [tdd:required] | `bun test` green（枠ON/OFF→border値・selectionStyle 4種マッピング・modal ON で背景 dim＋前面明るカード・skeleton 3分岐・**不変条件: eventCapture が常に1個 / コンテナ ≤ 8**）・`biome check` 0 | 9.2 | cc:完了 |
| 9.4 | **glass driver `glass/useUiLabGlasses.ts` + `AppGlasses.tsx`**: raw SDK で再描画（params 変更で `rebuildPageContainer`・**約40msデバウンス**）・上下で選択行移動・タップで modal トグル。hisho `useHishoGlasses` パターン流用 [tdd:skip:device-io] | `bun run build` 成功・シミュレーターで枠/選択4種/skeleton/modal/brightness の反映をスクショ確認（`test-with-simulator`/`simulator-automation`）・`biome check` 0 | 9.3 | cc:TODO |
| 9.5 | **companion コントロールパネル**: `Companion.tsx`（Slider/Segmented/Toggle を DesignParams にライブ束縛）＋ `ExportPanel.tsx`（JSON ＋ 生成 container の TS スニペット・コピー）。状態 lift-up + storage [tdd:required（純ロジック）] | `bun test` green（コントロール変更→params 更新・出力スニペットが params と一致）・`bun run build` 成功・`biome check` 0 | 9.2, 9.3 | cc:TODO |
| 9.6 | **検証 + パッケージング**: `bun test` 全 green / `biome check` 0 / `bun run build` 成功。シミュレーターで全ノブ（枠・余白・選択4種・skeleton・modal・brightness）反映を目視。`evenhub pack app.json dist -o ui-lab-v0.0.1.ehpk`（build→pack 順）。実機サイドロードはユーザー [tdd:skip:integration-e2e] | 3 コマンド green + シミュレーターで全ノブ反映 PASS + `ui-lab-v0.0.1.ehpk` 生成。実機はユーザー | 9.4, 9.5 | cc:TODO |

### Phase 9 スコープ外（YAGNI / v2 以降）

- プリセット保存・呼び出し / specimen（お手本画面）の複数化 / コンテナ個別エディタ / スマホ側の近似プレビュー（v1.5）/ 画像コンテナ / ストア公開。

### Phase 9 プロセス

ブランチ `feat/ui-lab-sandbox` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke →（任意で Codex Review）→ PR → bot レビューループ → squash merge。`apps/ui-lab` 限定（g2hermes / hisho / even-toolkit 無改変）。

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
