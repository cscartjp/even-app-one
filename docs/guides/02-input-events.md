# 入力とイベント(Input & Events)

> 原文: https://hub.evenrealities.com/docs/guides/input-events
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## 入力ソース

| ソース | ジェスチャー | 備考 |
|---|---|---|
| Even G2 テンプル(つる)のタッチパッド | 押下 / ダブル押下 / 上スワイプ / 下スワイプ | メインの入力 |
| Even R1 リング | 同上 | G2 と同じジェスチャーセット。発生元の識別が可能 |
| IMU | 頭の向き・動き | [デバイス API](04-device-apis.md) 参照 |

## イベントタイプ一覧(`OsEventTypeList`)

| 定数 | 値 | 意味 |
|---|---|---|
| `CLICK_EVENT` | 0 | 単一押下 |
| `SCROLL_TOP_EVENT` | 1 | 上スワイプ / スクロール上限到達 |
| `SCROLL_BOTTOM_EVENT` | 2 | 下スワイプ / スクロール下限到達 |
| `DOUBLE_CLICK_EVENT` | 3 | ダブル押下 |
| `FOREGROUND_ENTER_EVENT` | 4 | アプリがフォアグラウンドに復帰 |
| `FOREGROUND_EXIT_EVENT` | 5 | アプリがバックグラウンドへ移行 |
| `ABNORMAL_EXIT_EVENT` | 6 | 予期しない切断(Bluetooth 切断など) |

## イベント処理の基本形

```typescript
bridge.onEvenHubEvent(event => {
  const textEvent = event.textEvent
  if (!textEvent) return

  switch (textEvent.eventType) {
    case OsEventTypeList.CLICK_EVENT:
    case undefined:
      // 単一押下の処理
      break
    case OsEventTypeList.DOUBLE_CLICK_EVENT:
      // ダブル押下の処理
      break
    case OsEventTypeList.SCROLL_TOP_EVENT:
      // 上スワイプの処理
      break
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      // 下スワイプの処理
      break
  }
})
```

## イベントルーティングの重要な制約

- **`isEventCapture: 1` を設定できるコンテナはページにつき 1 つだけ**
- つまり、ページごとに「入力を受け取るコンテナ」を 1 つ決めて設計する
- コンテナの種類(Text / List)によって届くイベントが異なる

## ライフサイクルイベントへの対応指針

| イベント | やるべきこと |
|---|---|
| `FOREGROUND_ENTER_EVENT` | 表示の更新・ポーリングを再開する |
| `FOREGROUND_EXIT_EVENT` | 不要な処理を一時停止する |
| `ABNORMAL_EXIT_EVENT` | Bluetooth 切断を想定したクリーンアップ |

---

[← 前へ: ページライフサイクル](01-page-lifecycle.md) | [次へ: ディスプレイと UI システム →](03-display-ui.md)
