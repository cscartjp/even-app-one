# ページライフサイクル(Page Lifecycle)

> 原文: https://hub.evenrealities.com/docs/guides/page-lifecycle
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

グラスの画面は、SDK のメソッド呼び出しで「生成 → 更新 → 再構築 → 終了」を管理する。

## 主要メソッド一覧

| メソッド | 役割 | 使いどころ |
|---|---|---|
| `createStartUpPageContainer` | 初期ページの生成 | 起動時に **1 回だけ**呼ぶ |
| `rebuildPageContainer` | ページ全体の置き換え | コンテナのレイアウト構成を変えるとき。全面再描画で状態は失われる |
| `textContainerUpgrade` | テキストのインプレース更新 | **ちらつきなし**。カウンター・ステータス・ライブデータなど頻繁な更新向け |
| `updateImageRawData` | 画像コンテナの更新 | **並行送信は不可**(直列化必須) |
| `shutDownPageContainer` | アプリの終了 | 引数で「即時終了」か「確認ダイアログ付き終了」かを指定 |
| `callEvenApp` | 汎用メソッド呼び出し | 型付きメソッドの内部で使われるラッパー |

## 戻り値・結果コード

**`createStartUpPageContainer`:**

| 値 | 意味 |
|---|---|
| 0 | 成功 |
| 1 | パラメータ不正 |
| 2 | サイズ超過 |
| 3 | メモリ不足 |

**その他のメソッド** は boolean またはステータス文字列を返す:
`success` / `imageException` / `imageSizeInvalid` / `imageToGray4Failed` / `sendFailed`

## 使い分けの指針

- **テキストを頻繁に更新する** → `textContainerUpgrade`(ちらつかない)
- **レイアウト構成自体を変える** → `rebuildPageContainer`(全体再構築)
- 更新時は `containerID` と `containerName` を**生成時と完全一致**させること
- `updateImageRawData` は**必ず直列に**呼ぶ(前の送信完了を待ってから次を送る)

## 関連ページ

- [入力とイベント](02-input-events.md) — フォアグラウンド復帰などのライフサイクルイベント
- [アプリ提出と QA ガイドライン](../reference/app-submission.md) — 終了フローの審査要件

---

[← 前へ: アーキテクチャ](../getting-started/04-architecture.md) | [次へ: 入力とイベント →](02-input-events.md)
