# UI Lab サンドボックス — product contract

作成日: 2026-06-12

`apps/ui-lab`: Even G2 のグラス表示（コンテナ方式）の UI デザインを、**スマホ companion 上のコントロールパネルで実時間に変えながらグラスで見比べる**学習・試作用サンドボックスアプリ。

- precedence: 本 spec > `Plans.md` Phase 9
- 関連実装パターン（再利用元）: `apps/hisho/src/glass/homeCards.ts`（raw SDK 角丸枠カード）/ `apps/hisho/src/glass/useHishoGlasses.ts`（raw SDK ドライバ）

---

## 目的 / 非目的

**目的**: 「クラスの画面（＝グラス表示）」が *絶対座標で置いたテキストコンテナの集合* であることを体で理解し、`borderWidth` / `borderRadius` / `borderColor` / `padding` / 選択表現 / レイアウト骨格 / 擬似モーダルを振って見比べ、気に入った数値を実アプリへ移植できるようにする。

**スコープ内（v0.0.2〜）**: 画像コンテナ（**negative result の検証デモ用途に限定**）。`modalStyle:'image'` のとき不透明モーダルを 1 枚画像（背景塗り＋枠＋ドット絵モチーフ）として焼き、画像を前面に置く。これは「不透明モーダルは作れない」ことを実機で示す検証デモであり、不透明化は成立しない（理由は下記「画像モーダル＝negative result」を参照）。代償として画像コンテナは常時こまかくちらつく（ファーム仕様・根治不可）— companion 上に明示する。

**非目的（YAGNI / v2 以降）**: プリセット保存・呼び出し / specimen（お手本画面）の複数化 / コンテナ個別エディタ / スマホ側の近似プレビュー / 画像コンテナの汎用利用（モーダルデモ以外）/ 配布ストア公開。

---

## アーキテクチャ

```text
Even G2 glasses（576×288px・4bit 緑階調・コンテナ方式）
  ↑↓ Bluetooth
Even Realities App on phone WebView ── apps/ui-lab
  ├─ companion（スマホ画面 = コントロールパネル・通常の Web UI）
  └─ glass driver（同一アプリ内・raw SDK でグラスをライブ再描画）
```

- ネットワーク無し。companion の操作 → 同一 React tree の `DesignParams` state 更新 → glass driver が raw SDK で再描画、で完結。
- スタックは `apps/hisho` と同一（Vite + TS + React + react-router + even-toolkit + raw SDK `@evenrealities/even_hub_sdk`）。
- `app.json` の `permissions` は **空**（位置・マイク等不要）。network whitelist も不要。

---

## データモデル（単一の真実 `DesignParams`）

companion で触る値＝グラスに焼く値。公式プロパティレンジ（`everything-evenhub:sdk-reference`）に従う。

| フィールド | 型 / レンジ | 意味 |
|---|---|---|
| `borderWidth` | int `0–5` | 枠の太さ（0=枠なし） |
| `borderRadius` | int `0–10` | 角丸 |
| `borderColor` | int `0–15` | 枠色（緑階調） |
| `padding` | int `0–32` | 内側余白（`paddingLength`） |
| `cardWidth` | int（≤ 576） | カード幅 |
| `cardHeight` | int（≤ 288） | カード高 |
| `lineGap` | int `0–24` | 行間（空行/間隔の擬似表現） |
| `selectionStyle` | `'cursor' \| 'filled' \| 'thickBorder'` | 選択中行の見せ方 |
| `showStatusBar` | bool | 上部ステータスバー有無 |
| `separator` | `'none' \| 'line' \| 'dots'` | 区切り線スタイル |
| `skeleton` | `'list' \| 'cards' \| 'split'` | レイアウト骨格 |
| `modal` | bool | ON で擬似モーダル |
| `modalStyle` | `'border' \| 'image'`（既定 `border`） | モーダルの描き方。`border`=枠カードのみ（無ちらつき・背後が透ける／実用上の擬似モーダル）/ `image`=1 枚画像（**negative result の検証デモ**。不透明化は不可・常時ちらつく。下記参照） |

SDK 制約: G2 SDK の `TextContainerProperty` が実機描画できる色は `borderColor` のみ。`textColor` / `backgroundColor` は SDK 型に存在せず実機に描画されないため、本文色・背景色・背景 dim の数値ノブは持たない。

既定値は全フィールド公式レンジ内（例: `borderWidth:2, borderRadius:7, borderColor:12, padding:8, selectionStyle:'cursor', skeleton:'cards', modal:false`）。

---

## 画像モーダル＝negative result（不透明モーダルは作れない）

`modalStyle:'image'` は当初「不透明モーダルを成立させる唯一の方法」を狙ったが、実機検証（2026-06-15）で**不透明化は不可**と結論。コードは「不透明モーダルは作れない」ことを示す検証デモとして残す（削除しない）。

- **理由 1: 透過加算ディスプレイ**。Even G2 の画素は緑光を加算するだけで背後を遮蔽できない（黒=消灯=透過）。画像のベタ塗りを前面に置いても背後コンテナを覆い隠せず「不透明モーダル」にはならない（実機: `!` 等の明るい画素は出るが、ベタ塗り背景は不可視＝モーダルに見えない）。z 順で画像が前面に来ても遮蔽にはならない。
- **理由 2: SDK に遮蔽/alpha/z プリミティブが無い**。表示 API は `createStartUpPageContainer` / `rebuildPageContainer` / `updateImageRawData` / `textContainerUpgrade` のみ（host メソッド全列挙 `EvenAppMethod` でも同じ）で、dim / alpha / z 順 / 遮蔽 / オーバーレイの制御手段が存在しない。
- **唯一の本物モーダルは `shutDownPageContainer(exitMode=1)`**＝OS の「終了確認 前台交互層」（長押し→アプリ停止のあれ）。中身は OS 所有（終了 y/n）で**任意 UI には使えない**。
- **帰結（実用解）**: アプリ内モーダルの実用上限は **`modalStyle:'border'`（透過するが安定な borderColor 枠＋█ の擬似モーダル）**。画像方式は「不透明化」目的では行き止まり（しかも常時ちらつく）。将来 SDK / ファーム更新で遮蔽プリミティブが出れば変わりうる。

`modalStyle` の機能（image / border の切替・画像生成）自体は維持。下記不変条件 7・8 も画像方式の検証デモとして引き続き成立する。

---

## 中核：純粋関数 `buildContainers(params): CardContainerConfig[]`

`apps/hisho` の `homeCardConfigs` を一般化した副作用なし関数。`params` から raw SDK の `TextContainerProperty` 相当の構成配列を生成する。

**不変条件（テストで保証）**:
1. **`isEventCapture:1` のコンテナは常にちょうど1個**（全画面オーバーレイ）。
2. **テキストコンテナは常に ≤ 8 個**（`split` + status + separator + 行 + modal でも超えない）。
3. `borderWidth==0` のとき border 系（width/radius/color）は実質無効（枠なし）。
4. `selectionStyle` の各値が選択中行に対応する見た目を出す:
   - `cursor` = 行頭 `▶ `（無ちらつき）/ `filled` = 行頭・行末 `█` / `thickBorder` = その行に太枠。
5. `skeleton` 分岐: `list`（枠なし行リスト）/ `cards`（角丸枠カード群）/ `split`（左右2カラム）。
6. `modal==true && modalStyle=='border'` のとき: 背景カードの `borderColor` を dim 値（固定 `4`）へ落とし、前面に明るい太枠（`borderColor:15`, `borderWidth>=3`）テキストカードを1枚重ねる。
7. `modal==true && modalStyle=='image'` のとき: テキストモーダルカードは **置かない**。代わりに画像コンテナ 1 個（`buildModalImageContainer()`・ID 9・テキスト ID `≤8` と非衝突）を宣言し、その画素は `buildModalImage(params)` が生成する。画像方式でも不変条件 1・2（event-capture ちょうど1個・テキスト ≤8）は維持される。
8. **画像コンテナは ≤ 4 個**（モーダル画像は最大 1 個なので常に満たす）。`buildModalImage` の出力は raw 4bit グレースケール（1 画素=1 値 `0..15`、`length = width*height`）、サイズは画像制約の安全側交差（幅 `200`・高さ `100`、SDK 上限 288×144 と docs 記載 200×100 の両方を満たす）に固定。

---

## グラス同期（raw SDK ドライバ）

`apps/hisho/src/glass/useHishoGlasses.ts` のパターンを流用。

- ノブ変更＝コンテナの *プロパティ* 変更なので **`rebuildPageContainer` で再描画**（content のみの `textContainerUpgrade` では枠/色/余白は変わらない）。
- スライダー連続操作の洪水を避けるため **約 40ms デバウンス**。
- グラス入力: 上下で選択行移動（選択表現を各行で確認できる）/ タップで modal demo トグル。実操作の主役は companion 側。
- 画像方式モーダルの画素は **rebuild 時には送れない** → rebuild 後に `updateImageRawData`（`ImageRawDataUpdate`）で送る。**画像送信は直列化必須**だが、ドライバは 1 回の render 全体を `busyRef` で直列化しているため、rebuild → 画像送信が並行することはない。

---

## スマホ companion（コントロールパネル）

通常の Web UI（HTML `range`/`select`/`button`・even-toolkit `Toggle` 等）。

- 数値（borderWidth/radius/color/padding/cardW/H/lineGap）= スライダー。
- `selectionStyle` / `separator` / `skeleton` = セグメント。
- `showStatusBar` / `modal` = トグル。
- **出力パネル**: 現在の `DesignParams`（JSON）と、生成された container 構成の **コピペ可能な TS スニペット**を表示 → 気に入った数値をそのまま実アプリへ移植（学習ループを閉じる）。
- 最後の `DesignParams` を storage に永続化（リロードで復元）。

---

## 制約

- G2 表示は 576×288px・4bit 緑階調・コンテナ方式（CSS/DOM なし）。1画面のテキストコンテナ ≤ 8・画像 ≤ 4・`isEventCapture:1` はちょうど1個。
- 視覚確認の正は**実機 / シミュレータ**（ブラウザは 4bit / LVGL を忠実再現できない）。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` を invoke。
- 新規アプリのため version は 0.0.1 から（hisho/g2hermes の version-bump 規約の対象外）。
