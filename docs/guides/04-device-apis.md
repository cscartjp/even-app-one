# デバイス API(Device APIs)

> 原文: https://hub.evenrealities.com/docs/guides/device-apis
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## オーディオ(マイク)

```typescript
bridge.audioControl(true)   // 録音開始
bridge.audioControl(false)  // 録音停止
```

- データ形式: **PCM 16kHz / 符号付き 16bit リトルエンディアン / モノラル**
- 音声データはイベントコールバック内の `audioEvent` 経由で届く

## IMU(モーションセンサー)

```typescript
imuControl(isOpen, reportFrq)
```

| パラメータ | 型 | 説明 |
|---|---|---|
| `isOpen` | boolean | true で開始、false で停止 |
| `reportFrq` | `ImuReportPace` | レポート周期。停止時は省略可(デフォルト P100) |

- `ImuReportPace` 定数: **P100〜P1000**(100〜1000 に対応)

```typescript
bridge.onEvenHubEvent(event => {
  if (event.sysEvent?.eventType === OsEventTypeList.IMU_DATA_REPORT) {
    const { x, y, z } = event.sysEvent.imuData  // float
  }
})
```

## デバイス情報

| メソッド | 取得できるもの |
|---|---|
| `getDeviceInfo()` | モデル / シリアル番号 / バッテリー / 装着状態 / 充電状態 / ケース内かどうか |
| `onDeviceStatusChanged(status)` | バッテリー・装着・充電状態の変化をリアルタイム監視 |

## ユーザー情報

| メソッド | 取得できるもの |
|---|---|
| `getUserInfo()` | uid / 名前 / アバター / 国 |

## ローカルストレージ

```typescript
setLocalStorage(key, value)
getLocalStorage(key)
```

> 💡 審査要件として、初期セットアップ内容はローカルストレージに保存し、再起動のたびに再入力させないこと([アプリ提出と QA](../reference/app-submission.md))。

## OS イベントモデル

主要な型: `Text_ItemEvent` / `List_ItemEvent` / `Sys_ItemEvent` / `IMU_Report_Data`

`OsEventTypeList` の全イベント:
`CLICK_EVENT`, `DOUBLE_CLICK_EVENT`, `SCROLL_TOP_EVENT`, `SCROLL_BOTTOM_EVENT`, `FOREGROUND_ENTER_EVENT`, `FOREGROUND_EXIT_EVENT`, `ABNORMAL_EXIT_EVENT`, `SYSTEM_EXIT_EVENT`, `IMU_DATA_REPORT`

## できないこと(制約一覧)

- Bluetooth への直接アクセス
- 任意ピクセルの描画
- オーディオ出力(スピーカー再生)
- テキスト配置・フォントの制御
- 背景色
- リスト項目のスタイリング
- プログラムからのスクロール位置制御
- アニメーション
- カメラ
- カラー画像(グレースケールのみ)

---

[← 前へ: ディスプレイと UI システム](03-display-ui.md) | [次へ: UI/UX デザインガイドライン →](05-design-guidelines.md)
