# Hisho カード化 + バージョン表示 Plans.md（issue #37 / #44）

作成日: 2026-06-10
ワークストリーム: **Hisho アプリ**（root `Plans.md` の G2 Hermes Bridge とは別系統）
対象 issue:
- [#37 spike→本実装: Hisho セクションをネイティブ角丸枠（borderRadius）でカード化](https://github.com/cscartjp/even-app-one/issues/37)
- [#44 グラス表示にアプリバージョンを表示（アップデート反映の目視確認用）](https://github.com/cscartjp/even-app-one/issues/44) ← **Hisho に適用**（issue 本文は g2hermes 向けだが、本件は Hisho 対象とユーザー確定）

> Stage A（#37 モック見た目ゲート）は **Go 済み**（2026-06-09）。記録: `docs/plans/hisho-issue37-card-spike.md` / モック `apps/hisho/preview/design-mock-card-spike.html` / issue #37 コメント。本プランはその先（#37 本実装）と #44 を扱う。

## 確定済みの前提（公式スキル sdk-reference / glasses-ui / design-guidelines で裏付け）

- **【一次情報】ネイティブ枠は SDK 標準機能**（sdk-reference / glasses-ui）。`TextContainerProperty` と `ListContainerProperty` が `borderWidth`(0–5) / `borderColor`(0–15) / `borderRadius`(0–10・角丸) / `paddingLength`(0–32) を持つ。→ **#37「firmware が角丸枠を描けるか」は仕様上 YES が確定**。残る不確実性は「実機/シミュレーターの見え方」と「Hisho の描画層への統合経路」だけ。
- **【一次情報】枠の変更は rebuild が必要**（sdk-reference）。`textContainerUpgrade` は**コンテンツのみ**flicker-free。border プロパティ（width/color/radius）の変更は `rebuildPageContainer`＝**全画面再描画でちらつく**。公式の「選択ハイライト = `borderWidth` トグル」パターン（design-guidelines）はこの rebuild を伴う。→ **無ちらつきの選択は list コンテナの `isItemSelectBorderEn`（firmware ネイティブ選択枠）**、または content ベースのカーソル（`>`）/反転で表現する。
- **統合経路**: Hisho は高レベル even-toolkit API（`line()` 経由）で描画し、その層が `even-toolkit/glasses/bridge.ts` で `borderWidth:0` をハードコード。ネイティブ枠を出すには **(a) 対象画面だけ raw SDK（`@evenrealities/even_hub_sdk` の `createStartUpPageContainer` を直接呼ぶ・推奨）** か **(b) even-toolkit 低レベル `sdk-wrapper.ts` の `setBorder()`** を使う。fork は見送り。
- **コンテナ上限**（glasses-ui）: 1 ページ最大 12 コンテナ（text/list 計 8・image 4）、必ず 1 つに `isEventCapture:1`。ホームのカード化は text コンテナ数個で上限内。
- **⚠️ Hisho に `vite.config.ts` と `vite.config.js` が両方存在**。Vite の config 解決は `.js` 優先＝`.ts` は無視される可能性が高い。#44 の `define` 注入は**実際に使われる config**に入れること（#44 本文が懸念した罠が Hisho 側で現実化）。
- **Hisho アプリ版は `apps/hisho/app.json` の `version` = `0.1.7`**（`package.json` の `1.0.0` はアプリ版ではない・表示には使わない）。ステータスバーは `shared.ts` の `statusBarLines()` が `justifyToBarWidth('HISHO', 時計)`（separator 右端 540px に整列）。
- Hisho の検証コマンド: `bun test` / `bun run check`（biome）/ `bun run build`（`tsc -b && vite build`）。

---

## Phase 1: バージョン表示（issue #44・Hisho）— 低リスク・先行推奨

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | **使われている vite config を特定**（`.js`/`.ts` 重複の実体確認）し、その config で **`app.json` の `version`（=0.1.7）を読み**、`define` に `__APP_VERSION__` として注入（`package.json` ではない）。`tsc -b` を通すため global 宣言（`vite-env.d.ts` 等に `declare const __APP_VERSION__: string`）を追加。`[tdd:skip:build-config]` | `__APP_VERSION__` が `app.json` の version で build に注入され `tsc -b` がエラー 0 | - | cc:TODO |
| 1.2 | `statusBarLines()` のヘッダを `HISHO v${__APP_VERSION__}` に変更（案A）。`justifyToBarWidth` で 540px に収まり時計が押し出されないことを確認。収まらなければ案B（meta/ヒント行に控えめ併記）にフォールバック。`[tdd:required]` | `statusBarLines` の出力に version 文字列が含まれるテストが green。実幅（getTextWidth）で時計が欠けない | 1.1 | cc:TODO |
| 1.3 | 検証 + プレビュー。`bun test` green / `bun run check` 0 / `bun run build` 成功。`bun run preview:screens` 出力（`index.html`）or シミュレーターで version 表示をスクショ確認。`[tdd:skip:verify]` | 3 コマンド green + version が見えるスクショ | 1.2 | cc:TODO |

**Phase 1 プロセス**: ブランチ `feat/hisho-version-display` → Codex Review（`/codex:review`）→ PR → bot レビューループ → squash merge。

---

## Phase 2: ホームのカード化（issue #37・本実装）— Stage B 技術ゲート付き

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 2.1 | **Stage B（見え方確認＋統合経路の確定）**: ネイティブ枠は SDK 仕様上 OK が確定済みなので、ここは「実機/シミュレーターの見え方」と「経路選定」。raw SDK 直叩き（推奨）か even-toolkit `setBorder()` で border 付きコンテナを最小構成し、**シミュレーターでスクショ**（`everything-evenhub:test-with-simulator` / `simulator-automation`）。`[tdd:skip:spike-integration]` | 角丸枠の見え方をスクショ確認 + 採用経路（raw SDK / sdk-wrapper）を記録。見え方が割に合わない場合のみ wiki「線と枠の描画」に記録して #37 クローズ | Stage A=Go | cc:TODO |
| 2.2 | 採用経路で **Hisho ホームをカード化**（「電車情報」「グルメ情報」を `borderWidth>0`/`borderRadius`/`paddingLength` 付き text コンテナに）。box-drawing（`train.ts`/`shared.ts`）は無改変。**選択表現は (a) ホームを list コンテナ化して `isItemSelectBorderEn`（無ちらつき）か (b) カードは静的枠のまま選択は content カーソル/反転 を採用**（border トグルでの毎回 rebuild は避ける）。`[tdd:required]`（カード構成・選択状態のロジックに単体テスト） | ホームがカード描画され、選択ロジックのテストが green | 2.1 | cc:TODO |
| 2.3 | 検証: 10 行・幅に収まる / box-drawing と共存 / **選択移動で不要な全画面ちらつきが無い** をシミュレータースクショで確認（`test-with-simulator`）。`bun test` green / `bun run check` 0 / `bun run build` 成功。`[tdd:skip:verify]` | 3 条件のスクショ + 3 コマンド green | 2.2 | cc:TODO |
| 2.4 | 結論を wiki concept「線と枠の描画」に反映。採用なら正本モック `design-mock.html` への反映は**別途ユーザー承認後**（保護ファイル）。`[tdd:skip:docs]` | wiki 更新 + #37 最終結論コメント | 2.3 | cc:TODO |

**Phase 2 プロセス**: ブランチ `feat/hisho-home-cards` → Codex Review → PR → bot レビューループ → squash merge。

---

## DoD（issue 由来・統合）

**#44**:
- [ ] グラス（Hisho idle/ホーム相当）に version が表示される（1.2・`HISHO v0.1.7`）
- [ ] build 時注入で `app.json` の version（0.1.7）と一致（1.1）
- [ ] 10 行・幅制約に収まる（1.2/1.3）

**#37**:
- [ ] ネイティブ角丸枠を Hisho ホームで描画（SDK 仕様上 OK・シミュレーターで見え方をスクショ確認）（2.1/2.3）
- [ ] 実現経路を結論づけて記録（2.1/2.4）
- [ ] 出せた場合: 10 行制約・box-drawing 共存・ちらつき無し（2.3）
- [ ] 出せない/割に合わない場合: 理由を wiki に追記してクローズ（2.1/2.4）
- [ ] `bun test` green / `bun run check` 0 / `bun run build` 成功（1.3/2.3）

## 制約 / 注意

- **保護ファイル**: `apps/hisho/preview/design-mock.html`（UI デザイン正本）は無改変。spike/プレビューはコピー `design-mock-card-spike.html` を使用。正本反映は採用決定後に別途承認。
- **vite config 重複**: `.js`/`.ts` の二重存在。`define` は使われる方に入れる。不要な方の整理は karpathy「surgical」に従い**別タスク扱い**（今回は触れず、整理する場合は明示）。
- **10 行制約**: 実機 約10行・line height 27px・576×288px・4bit 緑階調。枠は上下＋`paddingLength` を食う。version 行も幅に注意。
- **box-drawing（系統①）無改変**: 電車罫線（`train.ts`）はネイティブ枠（系統②）と別物。共存させる。
- **ちらつき（公式仕様・sdk-reference）**: border プロパティ（width/color/radius）の変更は `rebuildPageContainer`＝全画面再描画でちらつく（`textContainerUpgrade` はコンテンツのみ無ちらつき）。**静的なカード枠は一度描けば無ちらつき**。選択移動でカード枠をトグルすると毎回 rebuild するので、選択は list の `isItemSelectBorderEn` か content カーソル/反転で表現する。
- **コード作業前に `andrej-karpathy-skills:karpathy-guidelines` を必ず invoke**（全コード変更に適用）。
- **2 issue = 2 ブランチ / 2 PR**（独立機能）。Phase 1 と Phase 2 は依存なし。Phase 1（低リスク）先行を推奨。

## 計画品質メモ

- **team_validation_mode**: `manual-pass`（Product/Architecture/Security/QA/Skeptic を単独多視点で評価）
  - Product: #44 は「実機の版確認」を最小変更で解決（ステータスバー併記）。#37 はホームの視認性向上（Stage A で Go）。両者ユーザー価値明確
  - Architecture: #44 = vite define 注入（Bridge の `VERSION` と同型）。#37 = ネイティブ枠は SDK 標準（sdk-reference で確定）。Hisho 統合は raw SDK 直叩き（推奨）か even-toolkit `setBorder()`。高レベル `line()` は border 不可。fork 見送り
  - Security: UI 表示のみ。秘密情報・権限・ネットワーク・課金への影響なし
  - QA: 10 行/幅/ちらつき/box-drawing 共存を各 DoD に明記。`bun test`/`check`/`build` を gate 化。シミュレーター確認は `test-with-simulator`/`simulator-automation`
  - Skeptic: #37 の feasibility は **公式 SDK 仕様で確定（`borderRadius` 0–10 ネイティブ）**。残リスクは「実機の見え方」と「選択ハイライトのちらつき」→ 2.1 でシミュレーター確認、選択は無ちらつき手段（`isItemSelectBorderEn`/content）に倒す。#44 の vite 二重 config 罠を 1.1 で先に潰す
- **Spec skip reason**: 両 issue とも UI 表示の局所変更（version 併記 / ホームのカード化）。Hisho に独立した product spec 文書は無く、UI 正本は `design-mock.html`。#37 採用時は正本モックへの反映を別途承認タスクとする（2.4）。新規データモデル・API・権限変更なしのため spec.md は新設しない。
- **車輪の再発明防止**: #44 は build 時 version 注入という Bridge の `VERSION`（`servers/g2-hermes-bridge/src/config.ts`・手書き const）と同じ役割をクライアントに持たせる。ただし**出どころは Hisho の `app.json` の `version`（=0.1.7）を vite で読む方式**にして手書き二重管理を避ける（`package.json` の 1.0.0 はアプリ版ではないので使わない）。#37 は even-toolkit の border 対応状況・既存 box-drawing 整列（`getTextWidth`）を実コードで確認済み。新規ライブラリ導入なし。

## 参照（公式スキル / docs — 本計画の根拠）

CLAUDE.md の everything-evenhub スキル必須ルールに従い、技術判断は以下の一次情報で裏付け済み:

- `everything-evenhub:sdk-reference` — `TextContainerProperty`/`ListContainerProperty` の border 系プロパティ・`createStartUpPageContainer`/`rebuildPageContainer`/`textContainerUpgrade` の更新粒度・`ListItemContainerProperty.isItemSelectBorderEn`
- `everything-evenhub:glasses-ui` — コンテナ上限・border 適用範囲（text/list のみ）・選択ハイライト/カード レイアウトのパターン
- `everything-evenhub:design-guidelines` — 表示制約（576×288・4bit・約10行）・Unicode・選択は borderWidth トグル（rebuild 前提）
- 実装/検証時に追加で使うスキル: `glasses-ui`（実装）・`handle-input`（↕選択・タップ）・`test-with-simulator` / `simulator-automation`（2.1/2.3 のスクショ検証）
- リポジトリ docs: `docs/guides/03-display-ui.md`（コンテナ方式）/ `docs/ai-tooling/skill-catalog.md`（スキル使い分け）

### マーカー凡例

| マーカー | 意味 |
|---------|------|
| `cc:TODO` | 未着手 |
| `cc:WIP` | 作業中 |
| `cc:完了` | Worker 作業完了 |
| `blocked` | ブロック中（理由を必ず記載） |

### Notes

- Created via: harness-plan create（manual-pass 検証付き・2026-06-10）。技術根拠は everything-evenhub 公式スキル（sdk-reference / glasses-ui / design-guidelines）を invoke して確定
- 本計画は Hisho 専用。root `Plans.md`（G2 Hermes Bridge）とは独立。
- 関連: Stage A 記録 `docs/plans/hisho-issue37-card-spike.md` / 過去 Hisho 計画 `docs/plans/hisho-v0.1.4-v0.1.7.md`
