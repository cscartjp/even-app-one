# G2 Hermes Bridge Phase 2: コンパニオン カスタム質問 設計ドキュメント

作成日: 2026-06-09

> 位置づけ: 本書は product contract `docs/spec/g2-hermes-bridge.md` の Phase 1（テキスト Bridge）資産の上に、**コンパニオン画面（スマホ WebView）からカスタム質問を編集・送信する機能**を具体化する設計デルタ。precedence は `docs/spec/g2-hermes-bridge.md` > 本書 > `Plans.md`。起票は GitHub issue cscartjp/even-app-one#30。Phase 1 の `/v1/ask`・セッション継続・`paginateForG2`、Phase 3 の glass 状態機械（`glass/reducer.ts`）は**改変せず再利用**する。
>
> 検証根拠: 2026-06-09 に Explore サブエージェント 2 体で実コードを照合（even-toolkit v1.7.2 の `web/*` エクスポート実在、g2hermes 現状の `useReducer`/`screen.ts`/`bridgeClient.ts`、hisho `glass/storage.ts` の実装）。本書 §2・§4 は issue #30 本文の一部設計（独立ストア）を**実コード確認のうえ簡素化して上書き**している。

---

## 1. 目的とスコープ

グラスにはキーボードが無い。**スマホ（コンパニオン画面）で質問を入力・設定し、グラスに反映する**のがコンパニオン画面の主用途。本 Phase で 2 つを追加する:

- **A 保存プリセット編集**: スマホで質問リストを追加 / 編集 / 削除 / 並べ替え → SDK ストレージへ永続化 → グラス idle メニューが保存リストを反映。
- **B その場送信**: スマホのテキスト欄に質問を打って「送信」→ 既存 ask フローで Hermes へ → 回答はグラスに表示し、スマホにもミラー表示。

利用形態は **個人が Even Hub（In-Development）経由で使うだけ**。アカウント / クラウド同期 / マルチユーザーは対象外。

## 2. 状態共有の方式（確定: 素の React lift-up・外部ストア不採用）

issue #30 本文は「独立ストア（`useSyncExternalStore` / `hermesStore.ts` 新設）」を提案していたが、**不採用**とする。理由:

- 個人が Hub 経由で使うだけで、外部ストアの仕組みを導入する必要がない（ユーザー判断 2026-06-09）。
- 会話ロジックは **すでに `glass/reducer.ts` に純粋関数として抽出済み**（`State`/`Event`/`reduce`、テスト 23 本）。「会話ロジックを切り出す＝改善」という issue の前提は既に満たされている。

**採用方式 = 素の React lift-up**:

- `App.tsx` を共有の親にし、**会話 `useReducer`（現在 `AppGlasses.tsx` 内）と presets を `App.tsx` へ持ち上げる**。
- `App.tsx` は `state` / `dispatch` / `presets` を `AppGlasses`（グラス描画）と `Companion`（スマホ UI）の両方へ props で渡す。
- `AppGlasses` は受け取った `state`/`presets` から従来どおり `snapshotRef` を組み、`useGlasses` の 100ms ポーリングで描画する（**ポーリング機構は無改変**）。
- B の送信は新経路を作らず、`Companion` の `AskBox` から **既存の ask 起動（`runAsk` 相当 = reducer に `ASK` を流す）を呼ぶだけ**。回答は同じ `state` を購読してミラー表示。

新規ストアファイル（`hermesStore.ts`）は**作らない**。共有は React の props/lift-up のみ。

## 3. データモデル（`companion/presets.ts` 純粋関数）

- 型 `Preset = { id: string; label: string; text: string }` — **ラベルと実プロンプトを分離**。
  - `label` = グラス表示用の短い文字列（**グラス idle メニューに表示される**）。
  - `text` = Hermes へ送る実プロンプト（**グラスには表示されない**）。
- 制約:
  - `label`: 1〜20 文字（グラス idle メニューの 1 行に収める表示制約）。空は拒否。
  - `text`: 1〜2000 文字（プロンプトはグラス非表示で長さ制約が実質ない。Bridge `/v1/ask` の zod は `text: z.string().min(1)` 上限なし、効くのは Fastify `bodyLimit` ~1MB のみ＝長文プロンプト可）。空は拒否。
  - 件数: 1〜8（idle はマイク診断 +「🎤 話す」+ ヒント行と同居）。
- デフォルトシード = 現行 `AppGlasses.tsx` の固定 4 問（`自己紹介` / `今できること` / `豆知識` / `今日の日付`）。
- 不正 JSON・空文字列・検証落ちはデフォルトシードへフォールバック（黙って壊さない）。

## 4. ストレージ（`companion/storage.ts` = hisho 参考に配列対応分だけ拡張）

hisho `glass/storage.ts` の**骨格を踏襲**しつつ、presets が配列である分だけ拡張する。「丸ごと移植」ではない（hisho は単一文字列キーで JSON もプリロードも持たない）。

- 正本 = `bridge.setLocalStorage/getLocalStorage`（`waitForEvenAppBridge` 1500ms タイムアウト）。dev は browser `localStorage` フォールバック。← **hisho 踏襲**。
- 書き込み**直列化キュー**（`Promise` chain で連続編集の順序保証、失敗は握り潰し state がキャッシュを兼ねる）。← **hisho 踏襲**。
- キー: `g2hermes.presets` に **presets 配列を `JSON.stringify` した 1 文字列**で保存（`removeLocalStorage` 非存在のため全件 1 キー上書きで削除を表現）。← **新規（hisho は JSON 非使用）**。
- **起動時プリロード**: `App.tsx` 初期化で `loadPresets()` を 1 回呼び、検証通過した配列（または default seed）を presets state の初期値にする。グラス idle が起動直後から保存リストを出せる。← **新規（hisho は呼び出し毎 await・プリロード無し）**。

## 5. コンパニオン UI（`even-toolkit/web`・hisho と同じ）

UI は hisho と同じ `even-toolkit/web`（v1.7.2・既存依存）で組む。独自デザインや別 UI フレームワークは入れない。

- レイアウト: `AppShell` + `NavHeader`（hisho `App.tsx` 踏襲）、`ScreenHeader` / `SectionHeader` でセクション分け。
- A（`PresetEditor`）: 各プリセットを 2 フィールドで編集 — ラベル=`Input`（1 行）/ プロンプト=`Textarea`（複数行・長文可）。リスト=`Card` + `ListItem`。**`ListItem` の `onDelete`（スワイプ削除内蔵・実在確認済み）**で削除。追加=`Button`。並べ替えは up/down ボタン（YAGNI: DnD は入れない）。
- B（`AskBox`）: `Textarea` + `Button`（送信）。回答は `Card` でミラー表示（送信中…/回答/エラー）。
- スタイル基盤: **g2hermes に Tailwind v4 を新規追加**（現状 g2hermes は `tailwindcss`/`@tailwindcss/vite`/`app.css` を持たない・確認済み）。`app.css` は hisho の `app.css` を踏襲（`@import "tailwindcss"` + toolkit `theme-light`/`typography`/`utilities` + `@source` 走査 + `@theme`）。`#root { max-width: 430px; margin: 0 auto }`。Tailwind v4 は toolkit コンポーネントの前提（公式テンプレのデフォルト）であり、特別な重いフレームワークではない。
- **追加依存**: `tailwindcss` + `@tailwindcss/vite`（devDeps）と `vite.config.ts` への `@tailwindcss/vite` プラグインのみ。`even-toolkit` / `react-router` / `tailwind-merge` は既存。

## 6. データフロー

**A 保存プリセット編集**

```
起動時: App で storage.loadPresets() → presets state（未設定/不正なら default seed）
編集:  PresetEditor → setPresets(next) → storage.savePresets(next)（write-through・直列化）
反映:  App が presets を AppGlasses に渡す → snapshot.presets → 100ms ポーリングで idle メニューへ
```

**B その場送信**

```
AskBox 送信 → App の runAsk(label:'(カスタム)', text) を呼ぶ（= reducer に ASK dispatch）
  → state.phase='thinking' → askBridge() → 'answer'+pages / 'error'
  → AppGlasses snapshot ポーリングで グラスに Thinking→回答 を表示
  → Companion は同じ state を購読し「送信中…/回答/エラー」をミラー表示
```

## 7. エラー処理

- 保存失敗（bridge 例外）: hisho 同様握り潰し、presets state がキャッシュを兼ねる（次回起動で再試行）。
- B 送信失敗: 既存 `askBridge` の `AskOutcome`（throw しない）を reducer の error phase に流す（現行挙動踏襲）。グラスとスマホ両方にエラー表示。

## 8. 受け入れ条件

- [ ] スマホで質問を追加 / 編集 / 削除 / 並べ替えでき、**アプリ再起動後も保存内容が残る**（SDK ストレージ）。
- [ ] 保存したプリセットがグラス idle メニューに反映される（「🎤 話す」とプリセットが併存）。
- [ ] スマホのテキスト欄（textarea・長文可）から送信 → グラスに Thinking → 回答が表示され、**スマホ側にも回答がミラー表示**される。
- [ ] プリセットは**ラベル（短・Input）とプロンプト（長文・Textarea）を分けて**編集でき、長文プロンプトを送れる。
- [ ] companion UI は `even-toolkit/web`（hisho と同じ）で構成し、独自 UI フレームワークを追加しない（追加依存は `tailwindcss` + `@tailwindcss/vite` のみ）。
- [ ] **外部ストア（`useSyncExternalStore`/`hermesStore.ts`）を導入しない**（素の React lift-up）。`glass/reducer.ts` と `useGlasses` ポーリングは無改変。
- [ ] `app.json` の network whitelist は不変・新権限なし。
- [ ] `bun test` グリーン（presets / storage / ask 遷移のユニット）、`biome check` 0、`bun run build` 成功。
- [ ] シミュレーターで A/B を確認（実機最終確認はユーザー）。

## 9. やらないこと（YAGNI）

- 独立ストア / `useSyncExternalStore` / `hermesStore.ts`（§2 で不採用確定）。
- アカウント / クラウド同期、複数会話セッション、プリセットのカテゴリ分け、ドラッグ&ドロップ並べ替え。
- グラス側での質問編集（キーボード無し前提を維持）。
- Bridge サーバーアドレスのランタイム設定（whitelist がネイティブ強制の静的マニフェストのため原理的に不可。`docs/guides/06-networking.md`）。
