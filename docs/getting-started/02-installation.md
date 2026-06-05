# インストール(Installation)

> 原文: https://hub.evenrealities.com/docs/getting-started/installation
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。バージョン番号は要約時点(2026-06)のものなので、最新は原文と npm を確認してください。

## 前提条件

| 必要なもの | 備考 |
|---|---|
| Node.js **v20 LTS または v22 以上** | v18 は非対応 |
| Web フレームワーク | **Vite 推奨** |
| スマートフォン + Even Realities アプリ | 実機テストに必要 |
| Even G2 スマートグラス | 実機テストに必要 |
| Even R1 リング | 任意。タッチパッド入力を追加できる |

シミュレーターがあるため、**実機がなくても UI とロジックの開発は始められる**。

## 1. SDK(プロジェクトごと)

```bash
npm install @evenrealities/even_hub_sdk
```

- 要約時点のバージョン: 0.0.10
- ディスプレイ制御・入力処理・オーディオ・デバイス情報・ローカルストレージの型付きメソッドを提供
- `app.json` の `min_sdk_version` を使用する SDK バージョンに合わせること

## 2. シミュレーター(グローバル)

```bash
npm install -g @evenrealities/evenhub-simulator
```

- 要約時点のバージョン: 0.7.2(macOS / Linux / Windows 対応)
- 実機なしで UI レイアウトとロジックをテストするためのツール
- あくまで実機テストの「補完」という位置付け(詳細は[シミュレーター](../reference/simulator.md))

## 3. CLI(グローバル推奨)

```bash
npm install -g @evenrealities/evenhub-cli
```

- 要約時点のバージョン: 0.1.12
- `evenhub` と短縮形 `eh` の 2 つのコマンドが入る
- 機能: 開発者アカウント認証、QR コードによるサイドロード、アプリのパッケージング

プロジェクト単位でバージョンを固定したい場合:

```bash
npm install -D @evenrealities/evenhub-cli
```

## 関連ページ

- [CLI リファレンス](../reference/cli.md)
- [パッケージングとデプロイ](../reference/packaging.md) — `app.json` スキーマとトラブルシューティング
- [シミュレーター](../reference/simulator.md) — オプションと注意事項

---

[← 前へ: 概要](01-overview.md) | [次へ: はじめてのアプリ →](03-first-app.md)
