# 概要(Overview)

> 原文: https://hub.evenrealities.com/docs/getting-started/overview
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。最新・正確な情報は原文を参照してください。

## Even Hub とは

Even Hub は、Even Realities のスマートグラス **Even G2** 向けアプリ(プラグイン)を開発・配布するためのプラットフォーム。

## Even G2 のハードウェア概要

| 項目 | 仕様 |
|---|---|
| ディスプレイ | 両眼マイクロ LED、**片眼あたり 576 × 288 ピクセル** |
| マイク | 4 マイクアレイ |
| 入力 | テンプル(つる)部分のタッチパッド |
| オプション入力 | Even R1 リング |

## 開発の基本スタイル

- **Web 標準技術(HTML / CSS / JavaScript)で開発する**
  - ただし実際にグラスに表示される UI は DOM ではなく、SDK 経由の「コンテナ」システム([ディスプレイと UI システム](../guides/03-display-ui.md)参照)
  - Web アプリ本体はスマートフォンの Even Realities アプリ内 WebView で動く
- **シミュレーターでテスト**してから実機(グラス)に配信する
- 現在サポートされているのは**プラグイン(バックグラウンドアプリ)**で、今後ウィジェットや AI スキルへの拡張が予定されている

## 開発の流れ(ざっくり)

1. [SDK / シミュレーター / CLI をインストール](02-installation.md)
2. [最小限のアプリを作って動かす](03-first-app.md)
3. [アーキテクチャを理解する](04-architecture.md)
4. 各種ガイドを参照しながら本格的に開発
5. [パッケージングして提出](../reference/packaging.md)

---

[次へ: インストール →](02-installation.md)
