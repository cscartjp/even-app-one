# Even G2 開発: SDK 機能の動作確認メモ（bigdra 氏）

> 原文: https://zenn.dev/bigdra/articles/eveng2-sdk-features
> ※ 本ページは bigdra 氏による Zenn 記事（2026-04-11 公開）の非公式な要約です。
> 検証コード: https://github.com/bigdra50/eveng2-demo

SDK の各機能を実際に動かして確認した記録。**機能別の実測値・制限値**が揃っており、公式リファレンスの裏付けとして有用。

## 検証環境

| 項目 | バージョン |
|---|---|
| Node.js | v25.8.2 |
| `@evenrealities/even_hub_sdk` | 0.0.9 |
| `@evenrealities/evenhub-cli` | 0.1.11 |
| `@evenrealities/evenhub-simulator` | 0.6.2 |
| TypeScript / Vite | 6.0.2 / 8.0.4 |
| Even Realities アプリ | 2.1.1 |

## UI 更新の 3 段階

| レベル | API | 用途 |
|---|---|---|
| 初回構築 | `createStartUpPageContainer` | アプリ起動時 |
| 再構築 | `rebuildPageContainer` | 画面全体の差し替え |
| 部分更新 | `textContainerUpgrade` / `updateImageRawData` | 状態変化時（フリッカーなし） |

## 機能別の確認結果

### テキスト表示

- 初回構築時の上限: **1,000 文字**
- `textContainerUpgrade` での更新上限: **2,000 文字**
- フリッカーなしの動的更新が可能。Unicode 記号も表示可

```typescript
const text = new TextContainerProperty({
  xPosition: 0, yPosition: 0,
  width: 576, height: 288,
  borderWidth: 1, borderColor: 5,
  containerID: 1,
  content: 'Hello, G2!'
})
```

### リスト表示

- スクロール可能なリスト UI
- 選択項目は `listEvent.currentSelectItemIndex` で取得

### 画像表示

- サイズ: 最小 20×20px 〜 最大 **200×100px**
- 1 ページあたり最大 **4 個**
- 形式: PNG / BMP バイナリ
- 制限: 同時送信不可、転送速度は BLE 帯域に依存

### 入力イベント

入力源: 右テンプル（`TOUCH_EVENT_FROM_GLASSES_R`）/ 左テンプル（`TOUCH_EVENT_FROM_GLASSES_L`）/ R1 リング（`TOUCH_EVENT_FROM_RING`）

`OsEventTypeList`:

| 値 | イベント |
|---|---|
| 0 | `CLICK_EVENT` |
| 1 | `SCROLL_TOP_EVENT` |
| 2 | `SCROLL_BOTTOM_EVENT` |
| 3 | `DOUBLE_CLICK_EVENT` |
| 4 | `FOREGROUND_ENTER_EVENT` |
| 5 | `FOREGROUND_EXIT_EVENT` |
| 6 | `ABNORMAL_EXIT_EVENT` |
| 7 | `SYSTEM_EXIT_EVENT` |
| 8 | `IMU_DATA_REPORT` |

### オーディオ（マイク）

- フォーマット: **PCM 16kHz mono 16bit**
- `bridge.audioControl(true/false)` で制御、`audioEvent.audioPcm` に `Uint8Array` で届く
- `app.json` に権限 `g2-microphone` の宣言が必須

```typescript
await bridge.audioControl(true)
bridge.onEvenHubEvent((event) => {
  const pcmData = event.audioEvent?.audioPcm
})
```

### IMU（加速度センサ）

- レポート間隔: 100ms / 500ms / 1000ms（`ImuReportPace`）
- `sysEvent.imuData` から x, y, z 軸を取得
- `imuControl(false)` で停止するまで継続的にプッシュされる

```typescript
await bridge.imuControl(true, ImuReportPace.P100)
```

### ストレージ（KVS）

- 文字列ベースの Key-Value Store: `getLocalStorage()` / `setLocalStorage()`
- 再起動後も保持。数値は文字列に変換して保存する

### デバイス情報

- `getDeviceInfo()`: モデル・シリアル番号・接続タイプ
- `getUserInfo()`: uid・名前・国
- `onDeviceStatusChanged()`: バッテリー残量・装着状態・充電中フラグ・ケース内フラグ

## 応用編

### GPS

- WebView 標準の `navigator.geolocation.watchPosition()` が利用可能
- `app.json` に権限 `location` の宣言が必須
- **重要な制限**: QR サイドロードでは `PERMISSION_DENIED` になる。**Hub アップロード後のみ動作確認可能**

### GIF アニメーション

公式非対応だが、`updateImageRawData` の連続送信で擬似的に実装可能:

1. gifuct-js でフレーム抽出
2. Canvas で合成・リサイズ・2 値化
3. PNG 変換して連続送信

実用 FPS の目安: **30×30px で約 9.3fps、50×50px で約 4.0fps**（BLE 帯域がボトルネック）。

---

[← 前へ: 開発入門（miyaura 氏）](01-miyaura-getting-started.md) | [目次に戻る](README.md) | [次へ: 実践知見集（gpsnmeajp 氏）→](03-gpsnmeajp-tips.md)
