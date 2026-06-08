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

## Plan: ホーム画面の最寄駅を手動選択できる仕組みを実装する（v0.1.6 想定）。

## 背景
- 現状: AppGlasses.tsx の watchPosition で GPS fix が来たら origin を現在地に差し替え、nearestStation(origin) でホームの最寄駅が決まる。GPS 失敗時は既定 origin（大保）固定でユーザーは変更不可。永続化の仕組みなし。
- 改善: GPS 取得成功なら自動セット（現状通り）。GPS 未取得時はホームの「最寄駅」行を選択可能にし、押すと駅選択画面へ。選択した駅は bridge.setLocalStorage で永続化し、次回起動時のデフォルトにする。

## 実装内容

**仕様更新（2026-06-07 ユーザー指示）**: GPS 取得中でも手動で駅を変えたいケースを考慮し、最寄駅行は**常に選択可能**にする。

### 1. storage モジュール新規作成（app/src/data/ or app/src/glass/）

wiki [[ローカルストレージ]]（公式プラグイン device-features + g2-notes 由来）の確認済み事項に従う:

- bridge.setLocalStorage('hisho.station', 駅名) / getLocalStorage で永続化（成功で true / 未存在キーは ""）
- **`removeLocalStorage` は存在しない** → 「自動」へ戻す時は空文字列 "" を書き込み、読み取り側で ""=未設定=自動モードとして扱う
- **読み取りは起動時 1 回だけ**（wiki 推奨のインメモリキャッシュパターンの最小形 — 値 1 キーなので Map は不要、React state がキャッシュを兼ねる）
- **bridge 書き込みはデバウンス・直列化が推奨**（wiki 注意点）→ 書き込みは駅選択決定時のみの低頻度なので直列化のみ意識（await を握りつぶさない）
- ブラウザ localStorage / IndexedDB は Flutter WebView のため再起動で消える → bridge が無い環境（シミュレーター/preview/dev）に限りブラウザ localStorage フォールバック（dev 専用の保険と明記）
- even-toolkit / @evenrealities/even_hub_sdk からの bridge 取得方法を確認すること
- 補足: ローカルストレージへの保存は審査要件でもある（設定の再入力を強いない → wiki [[アプリ審査]]）

### 2. ホーム画面（app/src/glass/screens/home.ts）
- メニューを常時 3 項目化: 最寄駅行（index 0）/ 電車情報 / グルメ情報
- 最寄駅行は GPS 状態にかかわらず常にハイライト対象、タップで /station へ navigate
- moveHighlight のクランプ上限を 2 に変更（固定なので分岐不要）
- 手動固定中はそれが分かる表示にする（例: 「最寄駅: 大保駅(固定)」。10 行制約内で調整）

### 3. 駅選択画面新規作成（app/src/glass/screens/station-select.ts、ルート /station）
- 選択肢は「自動（現在地から判定）」+ stations 4 駅（大保・西鉄小郡・花畑・西鉄福岡(天神)）の計 5 項目
- ↕で選択、タップで決定 → storage に保存（「自動」選択時は保存値をクリア）→ ホームに戻る
- 現在の設定値にマーク（✓等）を付けて表示
- AppGlasses.tsx の GLASS_ROUTES / createScreenMapper と selectors.ts のルーターに登録

### 4. AppGlasses.tsx の状態管理
- 起動時に storage から保存済み駅名を読み、手動選択駅 state にセット
- 優先順位: **手動選択（保存値） > GPS fix > 既定（大保）**
  - 手動選択があればその駅で固定（GPS が取れても上書きしない）
  - 「自動」に戻すと GPS fix > 既定 の従来動作
- AppSnapshot に手動選択駅（selectedStation: Station | null 等）を追加
- AppActions に駅選択アクション（setStation 等）を追加
- 注意: グルメ画面の距離計算 origin も同じ優先順位に従うか確認（最寄駅固定は電車用、グルメは現在地優先のままにするか要判断 → まずは origin ごと駅座標に切り替えるシンプル案で実装）

## 検証
- bun run typecheck / lint（biome）
- シミュレーターでの動作確認（GPS なし環境で駅選択 → 保存 → リロード後も保持）
- 実機（Hub In Development 経由）での bridge.setLocalStorage 動作確認はユーザーが実施

## 制約
- app/preview/design-mock.html は保護ファイル（読み取り専用、変更禁止）
- グラス表示は実機 10 行制約・576×288px
- コード作業前に andrej-karpathy-skills:karpathy-guidelines スキルを呼ぶこと

### Tasks

- [x] **Task 1**: bridge 取得方法の調査 + storage モジュール作成（`app/src/glass/storage.ts`）— `loadStationName(): Promise<string | null>` / `saveStationName(name: string | null): Promise<void>`。bridge.set/getLocalStorage（key: `hisho.station`、""=未設定）を使い、bridge 不在時はブラウザ localStorage フォールバック [tdd:skip:no-test-framework-detected] <!-- cc:done [d762a02] -->
- [x] **Task 2**: AppGlasses.tsx 状態管理 — 起動時に storage から読み込み、`selectedStation` state 追加、優先順位「手動 > GPS > 既定」で origin/最寄駅を導出。AppSnapshot に selectedStation・AppActions に setStation 追加 [tdd:skip:no-test-framework-detected] <!-- cc:done [2f4540e] -->
- [x] **Task 3**: 駅選択画面 station-select.ts 新規作成（ルート /station）— 「自動（現在地）」+ 4 駅の 5 項目リスト、現設定に●（✓はフォント未収録）、タップで保存してホームへ。GLASS_ROUTES / createScreenMapper / selectors.ts に登録 [tdd:skip:no-test-framework-detected] <!-- cc:done [4683621] -->
- [x] **Task 4**: home.ts メニュー 3 項目化 — 最寄駅行を常時選択可能に（index 0、タップで /station）、手動固定中の表示差別化、moveHighlight クランプ修正 [tdd:skip:no-test-framework-detected] <!-- cc:done [c1e3bbf] -->
- [x] **Task 5**: 検証 + パッケージング — typecheck / biome / preview:screens 確認、シミュレーターで選択→保存→リロード保持を確認、app.json を v0.1.6 へ bump、build + pack [tdd:skip:no-test-framework-detected] <!-- cc:done -->

> Task 5 検証メモ (2026-06-07): シミュレーターで 選択→保存→ページ full reload 後の復元 を確認（bridge 経由ラウンドトリップ OK）。シミュレーター**プロセス再起動**では消えるが、これはシミュレーターの bridge storage がメモリ実装のため（実機は Even アプリがネイティブ永続化）。実機確認はユーザー実施。

### Notes

- Created via MCP: harness_workflow_plan
- Mode: detailed
- Created at: 2026-06-07T12:35:49Z

---

Next Step: Use harness_workflow_work to start implementation

---

## Plan: グルメ（近い順）画面の左右分割化（v0.1.7）

作成日: 2026-06-08

正本（product contract）: `app/preview/design-mock.html`（**2026-06-08 確定版**・読み取り専用 chmod 444）。
グルメ（近い順）を左右分割（左=店舗リスト / 右=選択店舗の詳細）に変更済み。ユーザー承認済みデザイン。

- Spec delta: design-mock.html を 2026-06-08 に更新（左右分割・店名省略・TEL 行）。root spec.md は無くこのリポジトリでは design-mock.html が UI の product contract（Phase 1 と同じ規約）
- team_validation_mode: subagent（Explore エージェントで Architecture / QA / Skeptic 検証済み 2026-06-08。結論: 実現可能）

## 背景

- 現状の gourmet-nearby.ts は縦1列リスト + 選択店舗の詳細行が同じ縦リストに混在し、店舗が複数あると見にくい
- 確定デザイン: ヘッダー（タイトル + 件数 N/M）/ 左ペイン=店舗リスト（●○営業マーク + 店名 + 距離）/ 右ペイン=選択店舗詳細（正式名称(最大2行折返し) + 営業状況 + TEL + 補足）
- 店名は左リストで省略（全角9文字相当・距離は欠けさせない・100km 超なし前提）、右ペイン1行目に正式名称をフル表示
- モック内のラーメン5店舗（横浜家系ラーメン筑紫商店等）と TEL 092-555-xxxx は**架空のデモデータ**。shops.ts には追加しない

## 技術前提（サブエージェント検証済み・根拠付き）

- even-toolkit は **split モードをネイティブサポート**: `useGlasses` の `getPageMode` が 'split' を返すと `toSplit(snapshot, nav)` → `hub.showSplitPage/updateSplitPage(header, panes, layout)`（useGlasses.ts:93-99）
- `SplitLayout` で headerHeight / leftWidth / rightWidth 指定可（types.ts:59-77）。コンテナは overlay(1)+header(6)+left(7)+right(8) の4個で制限内（bridge.ts:224-285）
- ハイライトは text container の「▶ 」プレフィックス方式（types.ts renderTextPageLine）。FW リストコンテナは使わない（bridge.ts に API なし）
- headerHeight 固定なら選択移動は `updateSplitPage`（TextContainerUpgrade）で軽量更新・ちらつき低（bridge.ts:287-335）
- ピクセル幅省略は `@evenrealities/pretext` の getTextWidth で実装可能（shared.ts statusBarLines / train.ts padLeft と同パターン）
- **罠**: getPageMode に 'split' を追加しても toSplit 未定義だと text モードに静かにフォールバックする（useGlasses.ts:84,93）→ 配線は同一タスク内で行う
- render-screens.ts は toDisplayData のみ対応で split 非対応 → preview 生成の拡張が必要

## 実装内容

### 1. shared.ts: truncateByPixel ユーティリティ

- `truncateByPixel(text, maxPx): string` — getTextWidth で1文字ずつ幅を積算し、超過時は「…」を付けて省略（はみ出さない側に丸める）
- 左リスト店名上限はモックの「全角9文字相当」を pretext ピクセルに換算して定数化（leftWidth から距離・マーク・マージン分を引いて導出してもよい）

### 2. shops.ts: Shop 型に tel 追加

- `readonly tel?: string` を Shop に追加（省略可能。モック同様 TEL 無し店舗は行ごと非表示）
- 実在データへの tel 追記は判明している店舗のみ任意で（架空番号は入れない）

### 3. gourmet-nearby の split 化（本体）

- gourmet-nearby.ts に split ビルダーを追加（例: `gourmetNearbySplit(snapshot, nav): SplitData`）
  - header: ステータスバー1行（statusBarLines の本体行）+ タイトル行「{ジャンル} ({originLabel})」+ 右寄せ「N/M」（statusBarLines と同じ getTextWidth 右寄せパターン）
  - 左ペイン: `▶ `(選択行) + `●/○`(statusMark) + 省略店名 + 距離(formatDistance)。スクロールウィンドウは slidingWindowStart / buildScrollableList 相当を流用（maxVisible はモック準拠で 6〜7、実機10行制約から逆算）
  - 右ペイン: 正式名称（コンテナ幅で自動折返し・実質最大2行）+ 営業状況（statusMark + getShopStatus label）+ `TEL {tel}`（tel がある時のみ）+ 補足 note（ある時のみ）
  - 0件時は従来どおり text モードの「該当する店がありません」でよい（toSplit 内で空ペイン構成にするか text fallback かは実装時判断・モック非対象）
- selectors.ts: `toSplit` をエクスポート（gourmetNearby のみ split データ、他画面は呼ばれない前提でもガードを入れる）
- AppGlasses.tsx: `useGlasses` に `toSplit` を渡し、`getPageMode` を「home→'home' / gourmetNearby→'split' / 他→'text'」に変更
- action ハンドラ（HIGHLIGHT_MOVE / GO_BACK）は変更不要（共通のまま）

### 4. render-screens.ts: preview の split 対応

- gourmetNearby ノードを design-mock.html の構造（.nb-head / .nb-body / .nb-list / .nb-detail / .nb-name、NAME 省略、TEL 行）に合わせて HTML 化
- buildHtml() の CSS に design-mock.html の nb-* スタイルを追従（design-mock.html には一切書き込まない）

### 5. 検証 + リリース準備

- bun run typecheck / biome check エラー0
- `bun run preview:screens` → index.html がモックと構造一致（グルメ近隣をモックと並べて目視）
- シミュレーターで /gourmet → /gourmet/nearby の text↔split モード切替、↕で左ハイライト移動と右ペイン更新、ダブルタップで戻る、を確認（everything-evenhub:test-with-simulator / simulator-automation スキル使用）
- app.json version=0.1.7 へ bump、`bun run build` 成功、hisho.ehpk 生成。実機確認はユーザー実施

## 制約

- app/preview/design-mock.html は保護ファイル（読み取り専用 chmod 444、変更禁止）
- グラス表示は実機 line height 27px・最大10行・576×288px。split の headerHeight はステータスバー+タイトルの2行分で固定し、選択移動が updateSplitPage の軽量更新で済むようにする
- コード作業前に andrej-karpathy-skills:karpathy-guidelines スキルを呼ぶこと
- モックの架空デモ店舗・架空 TEL を shops.ts に持ち込まない

### Tasks

- [x] **Task 1**: shared.ts に truncateByPixel ユーティリティ追加（pretext getTextWidth・「…」付与・超過しない側に丸め） [tdd:skip:no-test-framework-detected] <!-- cc:done [565487f] -->
- [x] **Task 2**: shops.ts の Shop 型に `tel?: string` 追加（データ追記は判明分のみ任意・架空番号禁止） [tdd:skip:no-test-framework-detected] <!-- cc:done [fd773c5] -->
- [x] **Task 3**: gourmet-nearby split 化 — split ビルダー（header/左リスト/右詳細）+ selectors.ts に toSplit + AppGlasses.tsx の toSplit / getPageMode 配線（同一タスクで完結させること。getPageMode だけ先行すると text に静かにフォールバックする） [tdd:skip:no-test-framework-detected] <!-- cc:done [ce4d213] -->
- [x] **Task 4**: render-screens.ts の split 対応 — gourmetNearby を nb-* 構造で index.html に出力、CSS をモックに追従 [tdd:skip:no-test-framework-detected] <!-- cc:done [072002e] -->
- [x] **Task 5**: 検証 + v0.1.7 bump + build + pack — typecheck/biome 0、preview 目視一致、シミュレーターで split 遷移・選択更新確認 [tdd:skip:no-test-framework-detected] <!-- cc:done [1952829] -->

> Task 5 検証メモ (2026-06-08): シミュレーターで /gourmet → /gourmet/nearby の text→split 切替、↕で左ハイライト移動 + カウント(N/M) + 右ペイン詳細の連動更新、ダブルタップで /gourmet（text）復帰を確認。truncateByPixel は bun 実行でラーメン16件リストの全行が leftWidth 317px 以内（最長282px）・距離欠けなしを確認。実機確認はユーザー実施。

依存: Task 3 ← Task 1, 2 / Task 4 ← Task 3 / Task 5 ← Task 1〜4

### Notes

- Created via: harness-plan create（サブエージェント検証付き）
- Created at: 2026-06-08
- デザイン確定の経緯: 2026-06-08 セッションでモック3案（左右分割 → 店名省略幅拡大 → TEL 追加）をスクリーンショット検証しユーザー承認済み
