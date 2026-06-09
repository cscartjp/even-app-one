# G2 Hermes — 待ち時間テキストスピナー 設計デルタ（issue #36）

作成日: 2026-06-09

> 本書は product contract `docs/spec/g2-hermes-bridge.md` の上に、**待ち時間フェーズ（`thinking` / `transcribing`）のグラス表示にテキストスピナーを足す**機能の設計デルタです。
> precedence: `g2-hermes-bridge.md` > `g2-hermes-phase3-voice.md` > 本書 > `Plans.md`。
> 起票 = GitHub issue cscartjp/even-app-one#36。Bridge / STT / コンパニオンは無改変。スコープは `apps/g2hermes` のグラス UI のみ。

---

## 1. 目的とスコープ

`Thinking…` / `文字起こし中…` の待ち時間表示が現状**静的テキスト**で「固まって見える」。ここに**テキストスピナー**を足し、処理中であることを視覚的に伝える。

- **対象フェーズ**: `transcribing`（文字起こし待ち）/ `thinking`（Hermes 応答待ち）の **2 つだけ**。
- **対象外フェーズ**: `idle` / `recording` / `review` / `answer` / `error` は無改変。
- **対象外コンポーネント**: Bridge（`servers/g2-hermes-bridge`）/ STT サイドカー / コンパニオン UI は一切触らない。

## 2. 確定した設計判断（決定ログ）

| # | 判断 | 理由 |
|---|------|------|
| D1 | **画像アニメは不採用。テキストアニメで実現** | G2 の画像更新は BLE 1 フレーム ≈ 0.5〜2 秒・同時送信不可・差分エンコード無し（`glasses-ui` スキル）。スピナーに必要な fps が出ず BLE を占有する。テキストは `updateHomeText`→`textContainerUpgrade`（in-place・flicker-free）で回せる。 |
| D2 | **`recording` 中はアニメしない（静的 `REC ●` 据え置き）** | recording 中は mic PCM を BLE で常時転送中（`audioControl`）。テキスト更新を重ねると BLE 過負荷。待ち時間（mic 停止後）だけ回す。 |
| D3 | **`transcribing` = 流れるドット** | 音声を処理中の「流れる」感。`文字起こし中  ●────` → `─●───` → `──●──` → `───●─` → `────●`（ループ）。 |
| D4 | **`thinking` = 8 方向矢印（45°刻み）** | Hermes 思考中の「回ってる」感。`▲ ◥ ▶ ◢ ▼ ◣ ◀ ◤` の 8 フレーム。4 方向（90°刻み）よりなめらか。 |
| D5 | **フォールバックは線スピナー `│ ╱ ─ ╲`** | 万一 8 方向矢印が実機で滲む場合。`╱╲`（罫線斜め）も収録確認済み。 |

### グリフ収録の根拠（回転に使える/使えない）

公式グリフ表（even-g2-notes `docs/display.md`）で確認済み。

- **使える（収録確認済み）**: 8 方向矢印 `▲ ◥ ▶ ◢ ▼ ◣ ◀ ◤`、コーナー三角 `◢◣◤◥`、線スピナー `│ ╱ ─ ╲`、`●` / `─`。
- **使えない（未収録＝無表示スキップで破綻）**: braille `⠋⠙⠹…`（U+2800）、半円 4 相 `◐◓◑◒`（`◒◓` 未収録）、時計 4 分円 `◴◵◶◷`、上右ハーフブロック `▀▐`。

## 3. 描画契約（flicker-free を壊さない）

- アニメは `apps/g2hermes` の home モード単一テキストコンテナの中身差し替えのみで行う。**`updateHomeText`→`textContainerUpgrade`（in-place）経路に乗せ、`rebuildPageContainer` に落とさない**（落とすと毎フレーム全消し＝ちらつく）。
  - 根拠: `even-toolkit/glasses/useGlasses.ts:107-110`（home モード & 画像不変なら `needsRebuild=false`）→ `bridge.ts:413-416` `textContainerUpgrade`。本アプリは画像 0・home 固定なので経路に乗る。
- **カデンス ~180–200ms/frame**（8 フレームで 1 回転 ≈ 1.5s）。`useGlasses` の `textBusy` + `pending` コアレス（送信が詰まれば自動間引き）があるため BLE が詰まっても queue は溜まらない。
- **非等幅対策**: スピナーは**行末**に置く（左の固定文字が動かず幅揺れが見えない）。流れるドットは**専用の 1 行**に置き、横揺れの影響を局所化する。

## 4. 状態機械への影響（`glass/reducer.ts`）

- `State` に `frame: number` を足す。`TICK` イベントで `frame + 1`。
- **フェーズ入場（`STOP_RECORDING`→transcribing / `ASK`→thinking）で `frame = 0` にリセット**し、スピナーを glyph[0] から始める。
- `TICK` は純粋に `frame` のみ増やし、他の state（phase / pages / transcript 等）を変えない。
- reducer は純粋関数を維持し、`bun test` で `frame` の増加・他 state 不変・入場リセットを検証する。

## 5. 副作用（`glass/AppGlasses.tsx`）

- `phase` が `thinking` または `transcribing` の**間だけ** `setInterval(~180–200ms)` で `TICK` を dispatch。
- **フェーズを抜けたら確実に `clearInterval`**: `thinking→answer/error`、`transcribing→review/error`、`BACK`、コンポーネント unmount。`useEffect` の依存に `state.phase`。
- dispatch → React 再描画 → 新 snapshot 参照 → `useGlasses` の 100ms ポーリングが拾い `updateHomeText`。

## 6. テスト方針

- **reducer ユニット（`bun test`）**: `TICK` で frame 増加 / 他 state 不変 / 入場リセット。`State` への `frame` 追加に伴う既存テストフィクスチャの更新を含む（`BACK→initialState` 等は `{...initialState}` で frame=0 に戻る）。
- **display ユニット（`bun test`）**: `screen.ts` の transcribing/thinking 分岐が `frame % glyphs.length` で期待グリフを返す（純粋関数なので unit 可能）。recording が静的 `REC ●` のままであること。
- **シミュレーター先行検証**: `▲◥▶◢▼◣◀◤` / `●─` の実描画をスクショで確認（グリフ表で収録確認済みのためリスク低。滲む場合は線スピナー `│╱─╲` にフォールバック、流れるドットの横揺れが目立つ場合はドット数削減）。
- **実機目視**: マイク経路は実機専用のため `transcribing` のアニメは実機で確認。`thinking`（プリセット質問）はシミュレーターで確認可能。

## 7. スコープ外

- `recording` のアニメ化（D2 で不採用）。
- 画像ベースのスピナー（D1 で不採用）。
- 1 行に両スタイル併記（`Thinking ▶   ●────`）。情報過多のためフェーズ別割り当てを採る。
- streaming 途中字幕・TTS・Bridge / STT / コンパニオンの変更。

## 8. 参照（読み取り照合の根拠）

- flicker-free 経路: `even-toolkit/glasses/useGlasses.ts:107-110` → `bridge.ts:413-416`（`updateHomeText`→`textContainerUpgrade`）
- ポーリング再描画: `useGlasses.ts:250-256`（100ms・snapshot 参照比較）
- 現状の待ち時間表示: `apps/g2hermes/src/glass/screen.ts`（`transcribing` / `thinking` / `recording` 分岐）
- 状態機械: `apps/g2hermes/src/glass/reducer.ts`（`State` / `Event` / `reduce` / `initialState`）
- 画像 BLE コスト・収録確認済みグリフ: `everything-evenhub` の `glasses-ui` / `design-guidelines` スキル、even-g2-notes `docs/display.md`

---

### Notes
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`（本書はその待ち時間 UX デルタ）、task ledger = `Plans.md`（本書を基に harness-plan で Phase 4 タスク化）。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` を必ず invoke（既存規約）。
