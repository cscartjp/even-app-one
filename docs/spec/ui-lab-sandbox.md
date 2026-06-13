# UI Lab サンドボックス — product contract

作成日: 2026-06-12

`apps/ui-lab`: Even G2 のグラス表示（コンテナ方式）の UI デザインを、**スマホ companion 上のコントロールパネルで実時間に変えながらグラスで見比べる**学習・試作用サンドボックスアプリ。

- precedence: 本 spec > `Plans.md` Phase 9
- 関連実装パターン（再利用元）: `apps/hisho/src/glass/homeCards.ts`（raw SDK 角丸枠カード）/ `apps/hisho/src/glass/useHishoGlasses.ts`（raw SDK ドライバ）

---

## 目的 / 非目的

**目的**: 「クラスの画面（＝グラス表示）」が *絶対座標で置いたテキストコンテナの集合* であることを体で理解し、`borderWidth` / `borderRadius` / `borderColor` / `paddingLength` / 選択表現 / レイアウト骨格 / 擬似モーダルを振って見比べ、気に入った数値を実アプリへ移植できるようにする。

**非目的（YAGNI / v2 以降）**: プリセット保存・呼び出し / specimen（お手本画面）の複数化 / コンテナ個別エディタ / スマホ側の近似プレビュー / 画像コンテナ / 配布ストア公開。

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
| `modal` | bool | ON で擬似モーダル（背景 dim ＋前面に明るい枠カード） |

SDK 制約: G2 SDK の `TextContainerProperty` が実機描画できる色は `borderColor` のみ。`textColor` / `backgroundColor` は SDK 型に存在せず実機に描画されないため、本文色・背景色・背景 dim の数値ノブは持たない。

既定値は全フィールド公式レンジ内（例: `borderWidth:2, borderRadius:7, borderColor:12, padding:8, selectionStyle:'cursor', skeleton:'cards', modal:false`）。

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
6. `modal==true` のとき: 背景カードの `borderColor` を dim 値（固定 `4`）へ落とし、前面に明るい太枠（`borderColor:15`, `borderWidth>=3`）カードを1枚重ねる。

---

## グラス同期（raw SDK ドライバ）

`apps/hisho/src/glass/useHishoGlasses.ts` のパターンを流用。

- ノブ変更＝コンテナの *プロパティ* 変更なので **`rebuildPageContainer` で再描画**（content のみの `textContainerUpgrade` では枠/色/余白は変わらない）。
- スライダー連続操作の洪水を避けるため **約 40ms デバウンス**。
- グラス入力: 上下で選択行移動（選択表現を各行で確認できる）/ タップで modal demo トグル。実操作の主役は companion 側。

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
