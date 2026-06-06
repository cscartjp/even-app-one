# アーキテクチャ詳解

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/architecture.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## 概要

G2 は両眼デュアル micro-LED ディスプレイ搭載のスマートグラス。カメラなし・スピーカーなしのプライバシー重視設計。入力用の R1 コントロールリングとペアリングし、iPhone とは BLE 5.x（実用レンジ約 28m）で接続する。

## 接続モデルの実体

Even Hub アプリは「**自分のサーバーでホストする普通の Web アプリ**」。Vercel / Cloudflare / 自前 VPS など任意のホスティングで動かせる。iPhone はアプリと グラスの間の純粋なプロキシに過ぎない。

```
[自分のサーバー] <--HTTPS--> [iPhone WebView] <--BLE--> [G2 グラス]
```

- **Web アプリ**: 自分のサーバー上で動く。バックエンド・DB・API キーを持てる、ごく普通の Web アプリ
- **iPhone**: Even App（Flutter 製）が `flutter_inappwebview` でアプリの URL を開く。アプリロジックは実行せず、ページのロードと BLE メッセージ中継のみ
- **グラス**: ディスプレイ + 入力ペリフェラル。BLE で送られた UI コンテナを描画し、入力イベント（タップ・スクロール）を返す。グラス上でコードは一切動かない

SDK は WebView の `window` に JS ブリッジ（`EvenAppBridge`）を注入する。ブリッジは `flutter_inappwebview` の `callHandler('evenAppMessage', ...)` を使ったネイティブメッセージパッシングで、HTTP 通信ではない。

### 双方向通信

- **Web → グラス**: JS が `bridge.callEvenApp(method, params)` を呼ぶ → WebView ブリッジ経由で Flutter アプリが BLE でグラスへ中継
- **グラス → Web**: 入力イベント・ステータス更新が BLE で Flutter アプリへ → `window._listenEvenAppMessage(...)` で WebView に push

### アプリ設計への含意

- バックエンドに API キーや重い処理を置ける。グラス UI は薄いフロントエンドに徹する
- 標準的な Web セキュリティがそのまま適用される（セッショントークン、サーバーサイドシークレット、HTTPS）
- WebView は通常のブラウザ機能（fetch 等）も使える。ただし **ブラウザの `localStorage` は使わないこと** — `.ehpk` の WebView 内ではアプリ/グラスの再起動で消える。代わりに [SDK ストレージ](05-device-apis.md#sdk-ストレージ)（`bridge.setLocalStorage` / `getLocalStorage`）を使う

## 起動時の自動接続

ページロード時にユーザー操作を待たず自動で `bridge.connect()`（相当）を呼ぶべき。グラス装着中はスマホが手元にないことが多く、手動の「接続」ボタンタップを要求するのは UX として悪い。

```typescript
// ページロードごとに自動接続。ユーザーのクリック操作を不要にする
void actions.connect().catch((error) => {
  console.error('auto-connect failed', error)
})
```

フォールバックとして手動接続ボタンは残しつつ、起動時に自動発火させる。

## 開発フロー

1. `@evenrealities/even_hub_sdk` を import した Web アプリを任意のフレームワークで作る
2. 開発中はローカル起動 — Even App が `localhost` の URL を WebView でロード
3. 本番は任意のホスティングにデプロイ — Even App がその URL をロード

SDK: https://www.npmjs.com/package/@evenrealities/even_hub_sdk

```bash
npm install @evenrealities/even_hub_sdk
```

## SDK 初期化

ブリッジインスタンスの取得方法は 2 通り:

```typescript
import { waitForEvenAppBridge, EvenAppBridge } from '@evenrealities/even_hub_sdk'

// 方法1: 非同期で待つ（推奨）— ブリッジ準備完了で resolve
const bridge = await waitForEvenAppBridge()

// 方法2: 同期シングルトン — ブリッジ初期化済みの場合のみ使用可
const bridge = EvenAppBridge.getInstance()
```

## G2 ハードウェア仕様

- デュアル micro-LED ディスプレイ（緑）。左右は物理 FPC で同期（無線ではない）
- 片眼あたり 576×288 ピクセルのキャンバス
- 4bit グレースケール = 緑 16 階調。白ピクセルは明るい緑として表示、黒ピクセルは消灯
- BLE 5.x — 実用レンジ約 28m、G1 比 +9dB の出力
- マイク搭載（SDK からアクセス可能）
- テンプル（つる）先端のタッチジェスチャー
- R1 リング — スクロール/クリック入力用の独立した BLE デバイス
- 装着検知あり
- カメラなし、スピーカーなし

---

[← 前へ: 目次](README.md) | [次へ: ディスプレイと UI 詳解 →](02-display.md)
