# 入力イベントの癖（quirks）

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/input-events.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## イベント型（`OsEventTypeList`)

| イベント | 値 | 発生源 |
|---|---|---|
| `CLICK_EVENT` | 0 | リングタップ、テンプルタップ |
| `SCROLL_TOP_EVENT` | 1 | 内部スクロールが上端に達したとき |
| `SCROLL_BOTTOM_EVENT` | 2 | 内部スクロールが下端に達したとき |
| `DOUBLE_CLICK_EVENT` | 3 | リング/テンプルのダブルタップ |
| `FOREGROUND_ENTER_EVENT` | 4 | アプリがフォアグラウンドに来た |
| `FOREGROUND_EXIT_EVENT` | 5 | アプリがバックグラウンドに行った |
| `ABNORMAL_EXIT_EVENT` | 6 | 予期しない切断 |

## イベント配信

イベントは `bridge.onEvenHubEvent(callback)` で受け取る。コールバックには `EvenHubEvent` オブジェクトが渡され、いずれか 1 つのフィールドが入っている:

```typescript
type EvenHubEvent = {
  listEvent?: List_ItemEvent     // リストコンテナ由来
  textEvent?: Text_ItemEvent     // テキストコンテナ由来
  sysEvent?: Sys_ItemEvent       // システムレベルイベント
  audioEvent?: AudioEventPayload // マイク PCM
  jsonData?: Record<string, any> // デバッグ用の生ペイロード
}
```

**各イベントのフィールド:**

| 型 | フィールド |
|---|---|
| `List_ItemEvent` | `containerID`, `containerName`, `currentSelectItemName`（選択アイテムのテキスト）, `currentSelectItemIndex`（0 始まり）, `eventType` |
| `Text_ItemEvent` | `containerID`, `containerName`, `eventType` |
| `Sys_ItemEvent` | `eventType` のみ |

## イベントの癖（実アプリ開発で必読）

1. **`CLICK_EVENT = 0` が `undefined` になる:** SDK の `fromJson` が多くのケースで `0` を `undefined` に正規化してしまう。クリック判定は必ず `eventType === OsEventTypeList.CLICK_EVENT || eventType === undefined` で行うこと。

2. **`currentSelectItemIndex` が欠落する:** シミュレーター（時に実機も）は先頭アイテム（index 0）の `currentSelectItemIndex` を省略する。アプリ側の state で `selectedIndex` を追跡してフォールバックすること。

3. **イベントルーティングは `isEventCapture` で決まる:** `isEventCapture: 1` を持つコンテナの種類によって `listEvent` か `textEvent` かが決まる。リストがキャプチャを持てばスクロールはファームウェアが処理し境界イベントは `listEvent` で届く。テキストがキャプチャを持てば内部スクロールされ境界イベントは `textEvent` で届く。

4. **シミュレーターと実機の違い:** シミュレーターはボタンクリックを `sysEvent` で送るが、実機はアクティブなコンテナに応じて `textEvent` / `listEvent` を送る。**3 つすべてのイベントソースをハンドリングすること。**

5. **スワイプのスロットリング:** スクロールイベントは高速連発しうる。クールダウン（例: 300ms）を入れて重複アクションを防ぐ。

6. **ルートページのダブルタップは終了必須:** ホーム/ルートページで `DOUBLE_CLICK_EVENT` 時に `shutDownPageContainer(1)` を呼ばないアプリは Even Hub の審査でリジェクトされる。非ルート画面ではダブルタップを「戻る」として扱う。詳細は [ページライフサイクル – 審査要件](04-page-lifecycle.md#審査要件-ルートページのダブルタップで終了ダイアログを出す)。

---

[← 前へ: ディスプレイと UI 詳解](02-display.md) | [次へ: ページライフサイクル API →](04-page-lifecycle.md)
