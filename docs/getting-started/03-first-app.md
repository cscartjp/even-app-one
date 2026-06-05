# はじめてのアプリ(Your First App)

> 原文: https://hub.evenrealities.com/docs/getting-started/first-app
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。完全なコードは原文を参照してください。

## ゴール

最小限の「動くプラグイン」を作る:

1. アプリブリッジ(SDK)に接続する
2. グラスにテキストページを表示する
3. シミュレーター、または QR サイドロードで実機実行する

## 1. SDK の初期化

ブリッジ取得には 2 つの方法がある。

**方法 A: 非同期で待つ(推奨)**

```typescript
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()
```

**方法 B: 同期シングルトン**

```typescript
import { EvenAppBridge } from '@evenrealities/even_hub_sdk'

const bridge = EvenAppBridge.getInstance()
```

## 2. ページの作成

`TextContainerProperty` を使ってテキストコンテナを定義し、起動ページを作る。要点:

- 座標 `xPosition: 0, yPosition: 0`、サイズ `width: 576, height: 288`(全画面)
- `containerID: 1`、`containerName: 'main'` のように ID と名前を付ける
- 表示するテキスト(例: `"Hello from G2!"`)を渡す

ページ作成 API(`createStartUpPageContainer`)の戻り値:

| 値 | 意味 |
|---|---|
| 0 | 成功 |
| 1 | パラメータ不正 |
| 2 | サイズ超過 |
| 3 | メモリ不足 |

## 3. 実行する

**シミュレーター:**

```bash
evenhub-simulator http://localhost:5173
```

**実機(QR サイドロード):**

```bash
evenhub qr --url "http://192.168.1.100:5173"
```

生成された QR コードをスマートフォンの Even Realities アプリでスキャンすると、開発サーバーのアプリがグラスに読み込まれる。**ホットリロード対応**なので、コードを変更すると反映される。

> 💡 URL の IP アドレスは、スマートフォンから到達できる開発マシンの LAN アドレスを指定する。

## 次のステップ

- [ディスプレイと UI システム](../guides/03-display-ui.md) — 576×288 キャンバスの使い方
- [入力とイベント](../guides/02-input-events.md) — ジェスチャー対応
- [デザインガイドライン](../guides/05-design-guidelines.md) — グラス UI の設計原則

---

[← 前へ: インストール](02-installation.md) | [次へ: アーキテクチャ →](04-architecture.md)
