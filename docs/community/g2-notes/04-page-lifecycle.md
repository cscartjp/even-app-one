# ページライフサイクル API

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/page-lifecycle.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## `createStartUpPageContainer`

アプリ起動時に**ちょうど 1 回だけ**呼ぶ。初期ページレイアウトを確立する。戻り値は `StartUpPageCreateResult`（0=成功 / 1=不正 / 2=サイズ超過 / 3=メモリ不足）。

```typescript
const result = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: 2,
    textObject: [textContainer],
    listObject: [listContainer],
  })
)
```

**フィールド:** `containerTotalNum`, `listObject?`, `textObject?`, `imageObject?`

## `rebuildPageContainer`

ページ全体を置き換える。コンテナ数・型・レイアウトを変更できる。**画面遷移の基本手段**。

**挙動:** 完全再描画 — 全コンテナが破棄・再生成される。内部スクロール位置やリスト選択状態は失われる。実機では一瞬のちらつきが出る。

**フィールド:** `createStartUpPageContainer` と同じ。

## `textContainerUpgrade`

ページ全体を再構築せず、既存コンテナのテキストだけ更新する。高速で、実機ではちらつきなし。

```typescript
await bridge.textContainerUpgrade(new TextContainerUpgrade({
  containerID: 1,
  containerName: 'main-text',
  contentOffset: 0,
  contentLength: 50,
  content: 'New content',
}))
```

**フィールド:** `containerID`, `containerName`, `contentOffset?`, `contentLength?`, `content`

## `updateImageRawData`

既存の画像コンテナの画像データを更新する。**ページ作成後に呼ぶ必要がある** — 画像コンテナはこれを呼ぶまで空のプレースホルダ。

```typescript
// PNG バイト配列として送る
const pngBytes = Array.from(new Uint8Array(await pngBlob.arrayBuffer()));
await bridge.updateImageRawData(new ImageRawDataUpdate({
  containerID: 3,
  containerName: 'logo',
  imageData: pngBytes,
}))

// または base64 PNG 文字列として送る
const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
await bridge.updateImageRawData(new ImageRawDataUpdate({
  containerID: 3,
  containerName: 'logo',
  imageData: base64,
}))
```

戻り値は `ImageRawDataUpdateResult`（success / imageException / imageSizeInvalid / imageToGray4Failed / sendFailed）。**画像更新の同時送信は不可** — 1 件完了を待ってから次を送る。

## `shutDownPageContainer`

アプリを終了する。

```typescript
await bridge.shutDownPageContainer(0) // 0 = 即時終了
await bridge.shutDownPageContainer(1) // 1 = ユーザーに終了確認ダイアログを表示
```

### 審査要件: ルートページのダブルタップで終了ダイアログを出す

ルート（ホーム）ページでダブルタップ（`DOUBLE_CLICK_EVENT`）時に `shutDownPageContainer(1)` を呼ばないアプリは、Even Hub 審査チームに**リジェクトされる**。レビュアーからのメッセージ:

> Please ensure double tapping at the root page on OS can invoke exit dialogue (shutDownContainer(1)).

- 非ルート画面: ダブルタップ = 「1 つ戻る」（通例）
- ルートページ: ダブルタップで `exitMode: 1` を使ってホストのネイティブ終了確認を出す。**`0` を使うとダイアログをバイパスして同じ審査チェックに落ちる**

**最小実装例** — 現在の画面で分岐するディスパッチャ:

```typescript
import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'

function onEvent(event: EvenHubEvent) {
  const type = resolveEventType(event) // input-events.md 参照

  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    if (state.screen === 'main-menu') {
      // ルートページ: ホストに制御を返して終了ダイアログを出す
      void bridge.shutDownPageContainer(1)
      return
    }
    // それ以外の画面: 1 レベル戻る
    void goBack()
    return
  }
  // ...他のイベント型
}
```

`even-toolkit` の `useGlasses()` フックを使う場合はこの処理が組み込み済み: ホーム画面での `GO_BACK` をデフォルトで `showShutdownContainer(1)` にルーティングする（`shutdownOnHomeBack: true`）。手動でイベントをディスパッチする場合のみ自前実装が必要。

## `callEvenApp`（汎用エスケープハッチ)

任意のネイティブ Even App 関数を名前で呼ぶ低レベルメソッド。型付きメソッド（`getDeviceInfo`、`createStartUpPageContainer` 等）はすべてこれのラッパー。

```typescript
import { EvenAppMethod } from '@evenrealities/even_hub_sdk'

// enum を使う
const user = await bridge.callEvenApp(EvenAppMethod.GetUserInfo)

// 生の文字列を使う（未ドキュメント・将来のメソッド用）
const result = await bridge.callEvenApp('someNativeMethod', { param: 'value' })
```

**`EvenAppMethod` enum:**

| enum 値 | ネイティブメソッド文字列 |
|---|---|
| `GetUserInfo` | `'getUserInfo'` |
| `GetGlassesInfo` | `'getGlassesInfo'` |
| `SetLocalStorage` | `'setLocalStorage'` |
| `GetLocalStorage` | `'getLocalStorage'` |
| `CreateStartUpPageContainer` | `'createStartUpPageContainer'` |
| `RebuildPageContainer` | `'rebuildPageContainer'` |
| `UpdateImageRawData` | `'updateImageRawData'` |
| `TextContainerUpgrade` | `'textContainerUpgrade'` |
| `AudioControl` | `'audioControl'` |
| `ShutDownPageContainer` | `'shutDownPageContainer'` |

補足: `GetGlassesInfo` がネイティブ側の実メソッド名で、SDK の公開 API `getDeviceInfo()` はそのラッパー。

---

[← 前へ: 入力イベントの癖](03-input-events.md) | [次へ: デバイス API 詳解 →](05-device-apis.md)
