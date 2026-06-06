# デバイス API 詳解

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/device-apis.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## オーディオ

- `bridge.audioControl(true/false)` — マイクの開閉
- 事前に `createStartUpPageContainer` の呼び出しが必要
- PCM データは `onEvenHubEvent` 経由で `audioEvent.audioPcm`（`Uint8Array`）として届く
- **PCM フォーマット: 16kHz サンプルレート、10ms フレーム長（dtUs 10000）、40 バイト/フレーム、PCM S16LE（符号付き 16bit リトルエンディアン）、モノラル**

## デバイス情報

```typescript
const device = await bridge.getDeviceInfo()
// device.model – DeviceModel.G1 | DeviceModel.G2 | DeviceModel.Ring1
// device.sn – シリアル番号 (string)
// device.status.connectType – DeviceConnectType (none/connecting/connected/disconnected/connectionFailed)
// device.status.batteryLevel – 0-100
// device.status.isWearing – boolean（装着中か）
// device.status.isCharging – boolean（充電中か）
// device.status.isInCase – boolean（ケース内か）
```

- リアルタイム監視は `bridge.onDeviceStatusChanged(callback)`。戻り値は購読解除関数
- `DeviceInfo.updateStatus(status)` — ステータスのインプレース更新。ただし `status.sn === device.sn` のときのみ（シリアル番号不一致の更新は黙って無視される）
- ヘルパー: `DeviceInfo` に `isGlasses()` / `isRing()`、`DeviceStatus` に `isConnected()` / `isConnecting()` / `isDisconnected()` / `isConnectionFailed()` / `isNone()`
- 全モデル共通のシリアライズヘルパー: `toJson()`、`fromJson(json)`（static）、`createDefault()`（static、`UserInfo` と `DeviceStatus` のみ）

## ユーザー情報

```typescript
const user = await bridge.getUserInfo()
// user.uid – number
// user.name – string
// user.avatar – string (URL)
// user.country – string
```

## SDK ストレージ

Even Hub ブリッジ経由でスマホ側に永続化されるキーバリューストレージ:

```typescript
await bridge.setLocalStorage('key', 'value') // boolean を返す
const value = await bridge.getLocalStorage('key') // string を返す
```

**これが唯一の永続ストレージ。** ブラウザの `localStorage` は `.ehpk` の WebView 内ではアプリ/グラス再起動で消える。セッションをまたいで残したいもの（お気に入り・設定・読書位置など）は必ず `bridge.setLocalStorage` / `getLocalStorage` を使うこと。

`removeLocalStorage` は存在しない。キーを削除したい場合は空文字列を書き込み、読み取り時に空文字列を「未設定」として扱う。

### 推奨パターン: インメモリキャッシュラッパー

ブリッジのストレージ呼び出しは async のため、同期的な UI 読み取りには不便。推奨は起動時に全キーをインメモリの `Map` にプリロードし、読み取りはキャッシュから同期で、書き込みはキャッシュ即時更新 + バックグラウンドでブリッジへライトスルーするパターン:

```typescript
const cache = new Map<string, string>()

// 起動時、ブリッジ接続後・UI 描画前に実行
async function initStorage(bridge: EvenAppBridge, keys: string[]): Promise<void> {
  await Promise.all(keys.map(async (key) => {
    const value = await bridge.getLocalStorage(key)
    if (value) cache.set(key, value)
  }))
}

// キャッシュから同期読み取り
function getItem(key: string): string | null {
  return cache.get(key) ?? null
}

// ライトスルー: キャッシュは即時更新、永続化はバックグラウンド
function setItem(bridge: EvenAppBridge, key: string, value: string): void {
  cache.set(key, value)
  void bridge.setLocalStorage(key, value).catch(() => {})
}
```

## SDK が提供しないもの一覧

- BLE への直接アクセス
- 任意のピクセル描画（リスト/テキスト/画像コンテナモデルに限定）
- `imgEvent`（プロトコルには定義があるが SDK の型にはない）
- 音声出力（ハードウェアにスピーカーがない）
- テキストの中央寄せ・右寄せ
- フォントサイズ・ウェイト・ファミリーの制御
- コンテナの背景色・塗りつぶし
- リストアイテムごとのスタイル指定
- スクロール位置のプログラム制御（内部スクロールはファームウェア任せで、オフセットの取得・設定 API はない）
- アニメーション・トランジション
- カラー画像（画像コンテナは 4bit・16 階調グレースケールのみ）

---

[← 前へ: ページライフサイクル API](04-page-lifecycle.md) | [次へ: エラーコード →](06-error-codes.md)
