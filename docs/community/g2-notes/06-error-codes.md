# エラーコード

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/error-codes.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## ページ作成（`StartUpPageCreateResult`)

| コード | 意味 |
|---|---|
| 0 | 成功 |
| 1 | コンテナ構成が不正 |
| 2 | サイズ超過 — BLE 転送にはデータが大きすぎる |
| 3 | グラス側のメモリ不足 |

## ページ再構築（`rebuildPageContainer`)

戻り値は `boolean`。SDK 内部コード: `APP_REQUEST_REBUILD_PAGE_SUCCESS` / `APP_REQUEST_REBUILD_PAGE_FAILD`（原文ママ、typo あり）。

## テキスト更新（`textContainerUpgrade`)

戻り値は `boolean`。内部コード: `APP_REQUEST_UPGRADE_TEXT_DATA_SUCCESS` / `APP_REQUEST_UPGRADE_TEXT_DATA_FAILED`。

## 画像更新（`ImageRawDataUpdateResult`)

| コード | 意味 |
|---|---|
| `success` | OK |
| `imageException` | 画像処理エラー |
| `imageSizeInvalid` | 画像寸法がコンテナと不一致、または範囲外 |
| `imageToGray4Failed` | グレースケール変換失敗 |
| `sendFailed` | BLE 送信失敗 |

## シャットダウン（`shutDownPageContainer`)

戻り値は `boolean`。内部コード: `APP_REQUEST_UPGRADE_SHUTDOWN_SUCCESS` / `APP_REQUEST_UPGRADE_SHUTDOWN_FAILED`。

## SDK の JSON キー互換性

SDK はホストから届く複数のキー命名規則を受理する:

- camelCase: `containerID`
- PascalCase: `ContainerID`
- Proto 形式: `Container_ID`

内部の `pickLoose()` がアンダースコア除去 + 小文字化でキーを正規化する。**アプリ側のコードでは camelCase だけ使えばよい。**

イベントデータも複数の形を受理する:

- `data: { type: 'listEvent', jsonData: {...} }`
- `data: { type: 'list_event', data: {...} }`
- `data: [ 'list_event', {...} ]`（配列形式）
- `data: { type: 'audioEvent', jsonData: { audioPcm: [...] } }`

---

[← 前へ: デバイス API 詳解](05-device-apis.md) | [次へ: 実アプリの UI パターン →](07-ui-patterns.md)
