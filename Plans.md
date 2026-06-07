# Hisho v0.1.4 Plans.md

作成日: 2026-06-07

正本（product contract）: `app/preview/design-mock.html`（2026-06-07 確定の手作りモック・読み取り専用）。
全タスクはこのモックの見た目・行構成への一致を正解条件とする。

参考: デザイン決定の経緯はメモリ `hisho-train-app-design`（ステータスバー / ホームダッシュボード / 電車2カラム）。

---

## Phase 1: design-mock 正本の実装 (v0.1.4)

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 1.1 | 復元した design-mock.html と CLAUDE.md 保護ルールをコミット（ユーザー承認後） [tdd:skip:docs-only] | design-mock.html（statusbar・次発・2カラム入り）が main にコミット済み | - | cc:完了 [2005fd2] |
| 1.2 | ステータスバー共通実装: 全画面1行目に「HISHO」+ 右寄せ「2026年6月7日（日） 16:03」（曜日付き・分更新）、下に罫線。コンテンツは実質9行化 [tdd:skip:no-test-framework-detected] | 全画面（home/train/gourmet/gourmet-nearby）の出力1行目がバー。tsc / biome check エラー0 | 1.1 | cc:完了 [f1103ce] |
| 1.3 | ホームダッシュボード化（home.ts）: 「最寄駅: 大保駅」(meta) → 「電車情報」+ 方面ごと次発サブ行「次発 16:11 天神方面 / 16:20 大牟田方面」(meta・駅が持つ方面数ぶん) → 「グルメ情報」 → 最下行「↕選択 タップ決定」(meta) [tdd:skip:no-test-framework-detected] | モックの home ノードと行構成・スタイル(meta/inverted)が一致 | 1.2 | cc:完了 [331ae0d] |
| 1.4 | 電車2カラム化（train.ts + 駅マスタ拡張）: 左=天神方面・右=大牟田方面、│と┼の罫線、各方面4本、「16:11 6分後 ★」形式（種別マークは分後の後ろ）、凡例は駅ごとの文字列（大保「★=筑紫から急行 無印=普通」他駅「◆特急 ★急行 無印=普通」）を stations.ts に持たせる。1方面のみの駅は自動1カラム [tdd:skip:no-test-framework-detected] | 大保=2カラムでモックと一致、天神=1カラム表示が崩れない。方面切替スワイプ廃止 | 1.2 | cc:完了 [e455475] |
| 1.5 | tools/render-screens.ts buildHtml() をモックの HTML/CSS（.statusbar 等）に追従させ再生成 [tdd:skip:no-test-framework-detected] | `bun run preview:screens` の index.html がモックと構造一致（statusbar / home / train を目視確認）。design-mock.html には一切書き込まない | 1.2, 1.3, 1.4 | cc:完了 [20ec0f6] |
| 1.6 | バージョン 0.1.4 へ bump + build + pack [tdd:skip:no-test-framework-detected] | app.json version=0.1.4、`bun run build` 成功、hisho.ehpk 生成 | 1.3, 1.4, 1.5 | cc:完了 [0aaf22e] |

### スコープ外（v0.1.4 に含めない）

- グルメ画面のデザイン詰め（前セッションで保留中のまま）
- GPS 失敗の原因切り分け・エラーコード表示デバッグ（別タスク）
- shops.ts の defaultOrigin 復元（天神(テスト) → 大保駅）— GPS テスト継続中のため 0.1.4 は**天神(テスト)のまま**パック（2026-06-07 ユーザー判断）

### 実装メモ

- グラス実機は CSS/DOM なしの「コンテナ」方式（576×288・10行想定）。ステータスバーは TextContainer の1行として描画する
- design-mock.html は chmod 444 + CLAUDE.md 保護ルールで上書き禁止。preview:screens の出力先は index.html のみ
- 実装時判明: 実機は line height 27px 固定で最大10行 → ステータスバー下の罫線行は省略（モックは CSS border で行を消費しないため。2026-06-07 ユーザー判断）。スペーシングは `@evenrealities/pretext`（公式 pixel 測定）基準
- 実装時は `andrej-karpathy-skills:karpathy-guidelines` スキルを必ず invoke すること
