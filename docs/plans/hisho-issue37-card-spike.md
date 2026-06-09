# Hisho カード化 spike Plans.md（issue #37）

作成日: 2026-06-09
ワークストリーム: **Hisho アプリ**（root `Plans.md` の G2 Hermes Bridge とは別系統）
対象 issue: [#37 spike: Hisho セクションをネイティブ角丸枠（borderRadius）でカード化できるか検証](https://github.com/cscartjp/even-app-one/issues/37)

---

## 目的（spike）

Hisho の 1 画面（候補: ホーム / グルメ）を **ネイティブ角丸枠（firmware 描画の `borderRadius` 矩形）でカード化**できるか検証する。box-drawing（系統①・電車の罫線）の置き換えではなく、「枠で囲うレイアウト」導入の**可否を見る spike**。

**ユーザー指定スコープ: モック見た目ゲートまで先に。** まず HTML モックのコピーでカード化の見た目を確認し、良ければ技術検証（シミュレーターでネイティブ枠）へ進む 2 段構え。各ゲートで Go/No-Go を判断する。

## 確定済みの前提（実コードで裏付け済み・2026-06-09）

- **高レベル API（`line()` 経由）ではネイティブ枠を出せない**: `even-toolkit/glasses/bridge.ts` の home/columns/split が `borderWidth: 0` をハードコード（L233/239/251/392/398/446/453 で確認）。Hisho の全画面はこの `line()` / `buildScrollableList` 経路。
- **低レベル API は border 対応**: `even-toolkit/glasses/sdk-wrapper.ts` が `setBorder()` / `ElementBorder(width, color, radius)` を持ち、`borderWidth`/`borderColor`/`borderRadius` を emit（L240-363・borderRadius スペルは内製修正済み）。
- **`design-mock.html` は手作り HTML モック（見た目確認用）**。firmware が実際に角丸枠を描けるかは**モックでは検証不可** → モック編集は「見た目ゲート」、シミュレーター/実機が「技術ゲート」。
- 保護ファイル `apps/hisho/preview/design-mock.html`（UI デザイン正本）は**無改変**。spike は**コピー**（`design-mock-card-spike.html`）上で行う（ユーザー承認済み方針）。

## 実現経路の候補（技術ゲートで判断）

1. **composer / sdk-wrapper 直叩き**（even-toolkit 低レベル API で border 付きコンテナを構成）— 第一候補
2. **その画面だけ raw SDK**（`createStartUpPageContainer` に `borderWidth>0`/`borderRadius` 付きコンテナを渡す）
3. **even-toolkit に border オプションを足す**（fork/PR・スコープ大 = 今回は見送り候補）

---

## Stage A: モック見た目ゲート（ブラウザ・コスト最小）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| A.1 | `apps/hisho/preview/design-mock.html` を `design-mock-card-spike.html` にコピー（正本は無改変）。`[tdd:skip:spike-prototype]` | コピーが存在し、正本 `design-mock.html` の git diff が空 | - | cc:完了 |
| A.2 | コピー上で対象 1 画面（ホーム or グルメ）を **CSS の角丸枠カード**で再現（`border-radius` + `border` + 内側余白）。box-drawing 罫線とは別レイヤーで共存させる。`[tdd:skip:visual-mock]` | ブラウザでカード化レイアウトが表示できる | A.1 | cc:完了 |
| A.3 | **見た目ゲート判定**: スクショで (a) カード化が見た目を上げるか (b) 10 行相当（line height 27px・576×288px）に収まるか (c) box-drawing 罫線と喧嘩しないか を判断。Go/No-Go を本ファイルと issue #37 コメントに記録。`[tdd:skip:decision]` | Go/No-Go の結論がスクショ付きで記録される | A.2 | cc:完了 |

### Stage A 結果（2026-06-09・ホーム画面で実施）

対象=ホーム（「電車情報」「グルメ情報」をネイティブ角丸枠カード化）。実装は `design-mock-card-spike.html` の `renderHomeCards` + `.card` CSS。スクショ `/tmp/hisho-card-home.png`。

- (a) 見た目: ✅ 良。セクションが明確に分離。選択中カードは枠が明るく光り（`borderColor` トグル）、非選択は暗い枠。全反転（inverted）より上品。
- (b) 10 行制約: ✅ 余裕で収まる（電車カード=タイトル+次発2行+枠、グルメ=タイトル+枠、+ヘッダ/ヒント。下に空きあり）。
- (c) box-drawing 共存: ✅ ホームに罫線なし＝干渉なし。電車詳細（`train.ts` の罫線）は別画面・無改変。
- ⚠️ 限界: これは **HTML/CSS モック**。firmware が実際に `borderRadius` 角丸を描けるかは未証明 → **Stage B（シミュレーター/実機）で要検証**。

**見た目ゲート判定: Go 寄り（最終判断はユーザー）。** Go なら Stage B（技術ゲート）へ。

**ゲート**: A.3 が **No-Go** → 理由を wiki concept「線と枠の描画」に追記して issue #37 クローズ（Stage B 不要）。**Go** → ユーザー承認の上で Stage B へ。

---

## Stage B: 技術検証（シミュレーター・A.3 Go + 別承認後）

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| B.1 | 実現経路を選定（composer/sdk-wrapper 直叩き vs raw SDK）。対象画面だけ低レベル API で **border 付きコンテナ**を最小構成。`[tdd:required]`（border 構成ロジックに単体テスト） | 選定理由を記録 + border 付きコンテナを emit するコードが存在 | A.3=Go | cc:TODO |
| B.2 | シミュレーターで対象画面を描画 → **実際に角丸枠が出るか**をスクショで判定（`everything-evenhub:test-with-simulator` / `simulator-automation`） | スクショで枠の有無を判定済み | B.1 | cc:TODO |
| B.3 | 出た場合: 10 行制約に収まる・box-drawing 罫線と共存・不要なちらつき無し（`borderWidth` トグル＝`rebuildPageContainer` のちらつき確認）を検証 | 3 条件を満たすスクショ + `bun test` green / `biome check` 0 / `bun run build` 成功 | B.2 | cc:TODO |
| B.4 | 結論を wiki concept「線と枠の描画」に追記。Go なら follow-up issue/spec、出せない/割に合わないなら理由を記録して issue #37 クローズ | wiki 更新 + issue #37 の最終結論コメント | B.3 | cc:TODO |

---

## DoD（issue #37 由来）

- [ ] ネイティブ角丸枠を Hisho の 1 画面で出せるか/出せないかを、実機 or シミュレーターのスクショで判定（Stage B）
- [ ] 実現経路（composer 直叩き / raw SDK / 見送り）を結論づけて記録（B.1/B.4）
- [ ] 出せた場合: 10 行制約に収まり、box-drawing 罫線と共存し、不要なちらつきが無いこと（B.3）
- [ ] 出せない/割に合わない場合: 理由を wiki「線と枠の描画」に追記してクローズ（B.4）
- [ ] `bun test` green / `biome check` 0 / `bun run build` 成功（コードを足した場合・B.3）

## 制約 / 注意

- **保護ファイル**: `apps/hisho/preview/design-mock.html`（UI デザイン正本）は無改変。spike は `design-mock-card-spike.html`（コピー）で行う。良ければ正本反映は別途承認。
- **10 行制約**: 実機は約 10 行。枠は上下 2 行＋内側 `paddingLength` を食う。ホームは現状約 9〜10 行でタイト、グルメはスクロールリスト（maxVisible 6）。どちらが収まるか A.3 で判断。
- **ちらつき**: `borderWidth` 変更は `rebuildPageContainer`（軽いちらつき）。静的枠なら問題なし。選択ハイライトで毎回トグルすると点滅 → 既存パターン（borderWidth トグル）か別表現かを B.3 で検討。
- **矩形のみ**: 表の内部格子・斜め線は系統① box-drawing 担当。今回は「囲い枠」用途に限定。系統①（電車の罫線・`train.ts`/`shared.ts`）は無改変・共存。
- **コード作業前に `andrej-karpathy-skills:karpathy-guidelines` スキルを必ず invoke**（A.2 の CSS / B.1 のコードを含む全コード変更に適用）。

## プロセス

ブランチを切る → PR 前に Codex Review（`/codex:review` 正規ルート）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。spike の結論は wiki concept「線と枠の描画」に反映。

## 計画品質メモ

- **team_validation_mode**: `manual-pass`（spike・単独多視点パス）
  - Product: カード化は Hisho の見た目を上げるか/情報過多にならないか → A.3 見た目ゲートで先に判断（安価に No-Go 可能）
  - Architecture: 高レベル `line()` は border 不可（実コード確認済み）。低レベル sdk-wrapper か raw SDK の 2 経路。fork は今回見送り
  - QA: 10 行制約・ちらつき（`rebuildPageContainer`）・box-drawing 共存を B.3 の DoD に明記
  - Skeptic: **HTML モックは firmware 描画を保証しない** → モックは見た目ゲートに限定し、技術ゲートをシミュレーターで別途必須化（本計画の 2 段構えの核心）
- **Spec skip reason**: spike / 実現可能性調査のため product contract（Hisho spec）は更新しない。結論は wiki concept「線と枠の描画」が正本。カード化を採用する場合のみ follow-up で Hisho spec / Plans を更新する。
- **車輪の再発明防止**: 既存実装（`train.ts`/`shared.ts` の box-drawing + `getTextWidth` 整列）と even-toolkit の border 対応状況を実コードで確認済み。新規ライブラリ導入なし。

### マーカー凡例

| マーカー | 意味 |
|---------|------|
| `cc:TODO` | 未着手 |
| `cc:WIP` | 作業中 |
| `cc:完了` | Worker 作業完了 |
| `blocked` | ブロック中（理由を必ず記載） |

### Notes

- Created via: harness-plan create（manual-pass 検証付き・2026-06-09）
- 本計画は Hisho 専用。root `Plans.md`（G2 Hermes Bridge）とは独立。Hermes 側の「apps/hisho 改変しない」制約は Hermes ワークストリームのスコープ内ルールであり、本 Hisho spike には適用しない。
- 過去の Hisho 計画アーカイブ: `docs/plans/hisho-v0.1.4-v0.1.7.md`
