# アーキテクチャ(Architecture)

> 原文: https://hub.evenrealities.com/docs/getting-started/architecture
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## 接続モデル: 3 つの登場人物

```
┌──────────────────┐   HTTPS   ┌──────────────────────────┐  Bluetooth  ┌────────────────────┐
│  Even Hub Cloud  │ ───────→ │  スマートフォン            │ ←────────→ │  Even G2 グラス     │
│  (配布・ホスティング) │           │  Even Realities アプリ     │             │  (ディスプレイ + 入力) │
│                  │           │  (Flutter) + WebView      │             │                    │
└──────────────────┘           └──────────────────────────┘             └────────────────────┘
```

押さえておくべきポイント:

- **プラグインの実体はスマートフォン上で動く。** Even Realities アプリ(Flutter 製)内の WebView がプラグインをホストする
- **グラス側でアプリは実行されない。** グラスはディスプレイ表示と入力イベント(押下・スクロール・スワイプ)の発行だけを担当する(ネイティブなリストスクロール処理を除く)

## SDK ブリッジ(双方向通信)

| 方向 | 経路 |
|---|---|
| Web → グラス | `bridge.callEvenApp(method, params)` → WebView → Even Realities アプリ → Bluetooth → グラス |
| グラス → Web | グラス → Bluetooth → アプリ → `window._listenEvenAppMessage(...)` コールバック |

通常は SDK の型付きメソッド・イベントリスナーを使えばよく、この生の経路を意識する必要はない。

## ネットワークの注意点

- `app.json` のネットワークホワイトリストは **Even 側の権限チェック**であり、**CORS の回避ではない**
- 本番環境で `fetch()` を通すには「ホワイトリスト掲載」と「サーバー側の正しい CORS ヘッダー」の**両方**が必要
- 詳細は[ネットワーキング](../guides/06-networking.md)

## アプリのテスト方法(3 通り)

| 方法 | 用途 |
|---|---|
| **QR サイドロード** | CLI で QR を生成して実機に読み込み。ホットリロード対応。日常の開発用 |
| **プライベートビルド** | `evenhub pack` で `.ehpk` にパッケージ化し、開発者ポータルへアップロード |
| **シミュレーター** | 実機なしでレイアウト・ロジックを検証 |

## PWA という選択肢

Even Hub を経由せず、PWA として独立配布することも可能。パッケージングや審査プロセスの外で、配布・ホスティングを完全に自分で制御できる。

## プロジェクト構造

標準的な Web プロジェクトに `app.json` マニフェストを足しただけの構成:

```
my-app/
├── src/
│   ├── main.ts          # エントリーポイント
│   └── components/      # UI コンポーネント
├── public/
│   └── assets/          # 静的アセット
├── index.html
├── package.json
├── vite.config.ts       # ビルド設定(Vite 推奨)
├── tsconfig.json        # TypeScript 設定(任意)
└── app.json             # Even Hub マニフェスト(必須)
```

Even 固有の依存パッケージは `@evenrealities/even_hub_sdk` の**1 つだけ**。

---

[← 前へ: はじめてのアプリ](03-first-app.md) | [次へ: ページライフサイクル →](../guides/01-page-lifecycle.md)
