# 実アプリの UI パターン

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/ui-patterns.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

公開されている実アプリのコードから抽出された UI 実装パターン集。

## テキストカーソルによるフェイク「ボタン」

ボタンウィジェットは存在しないため、テキストコンテンツにアクションラベルを並べ、`>` プレフィックスでカーソル位置を表現する:

```
> Return
  Delete note
```

スクロールで `>` をアイテム間移動し、クリックで選択中のアクションを実行する。更新は `textContainerUpgrade` を使い、ページ全体のちらつきを回避する。

## テキストボーダーによる選択ハイライト

リストコンテナを使わずに選択状態を表す方法: 「行」を表す個々のテキストコンテナの `borderWidth` をトグルする（0 = 非選択、1–3 = 選択中）。

## マルチスロットテキストレイアウト

複数のテキストコンテナを行として使う（例: `height: 96` のコンテナ 3 つ = 288px）。各コンテナが 1 「アイテム」を表示し、それぞれ独自のボーダー状態を持つ。ネイティブリストウィジェットの「スクロール乗っ取り」なしでリスト風 UI を実現できる。

## Unicode によるプログレスバー

```typescript
const filled = '━'.repeat(n)
const empty = '─'.repeat(total - n)
const bar = filled + empty
```

## 画像ベースアプリのイベントキャプチャ

メイン表示が画像（Canvas 描画 UI・ゲームなど）の場合、画像コンテナには `isEventCapture` プロパティがないため、イベント受信用に別のコンテナが必要。

**リストではなくテキストコンテナを使うこと。** 隠し 1×1 のアイテム 1 個リストはスクロールイベントを生成しない — スクロールする対象がないため `SCROLL_TOP_EVENT` / `SCROLL_BOTTOM_EVENT` が一切発火せず、クリック/ダブルクリックしか届かない。

正解: 全画面のテキストコンテナ（content: `' '`）を画像の**背後**に置く。テキストコンテナがスクロール含む全イベント型を受信し、画像コンテナが上に描画される（containerID が大きい = 後に描画）ためテキストは見えない:

```typescript
const config = {
  containerTotalNum: 2,
  textObject: [
    new TextContainerProperty({
      containerID: 1,
      containerName: 'evt',
      content: ' ',
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      isEventCapture: 1,
      paddingLength: 0,
    }),
  ],
  imageObject: [
    new ImageContainerProperty({
      containerID: 2,
      containerName: 'screen',
      xPosition: 188,
      yPosition: 94,
      width: 200,
      height: 100,
    }),
  ],
}
```

補足: 画像コンテナ 1 つの最大サイズは 288×144 px。全画面（576×288）を覆うには画像コンテナを並べる（例: 288×144 を 2×2 のグリッドでタイル配置）。入力用には背後の `isEventCapture: 1` テキストコンテナを使う。

この構成で、画像を表示したままクリック・ダブルクリック・スクロール上端/下端イベントを受け取れる。イベントは `textEvent` として届く（`listEvent` ではない）のでハンドラ側で対応すること。

## 長文のページめくり

テキストコンテナはオーバーフロー時に内部スクロールするが、多くのアプリは約 400–500 文字／ページに単語境界で事前分割する方式を選んでいる。理由: 改ページを制御できる、進捗インジケーターを出せる、`rebuildPageContainer` の 1000 文字制限を回避できる。

実装: `pageIndex` を追跡し、`SCROLL_BOTTOM_EVENT` / `SCROLL_TOP_EVENT` でページを再構築。ヘッダーかフッターのコンテナにページインジケーターを表示する。

---

[← 前へ: エラーコード](06-error-codes.md) | [次へ: ブラウザ UI（even-toolkit）→](08-browser-ui.md)
