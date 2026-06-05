# Claude Code プラグイン(everything-evenhub)

> 原文: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/index
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## 概要

Even Realities は、Anthropic の CLI 型 AI コーディングツール **Claude Code** 向けに公式プラグイン **everything-evenhub** を提供している。スキル名を覚えなくても、自然言語の指示からプラグインが適切なスキルを自動選択してくれる。

## インストール

Claude Code 内で:

```
/plugin marketplace add even-realities/everything-evenhub
/plugin install everything-evenhub
```

## 使ってみる

例えば次のように指示するだけで、`quickstart` スキルが自動的に実行される:

```
Build me a hello-world app for the Even G2 glasses
```

## スキル体系(全 13 個)

| ティア | 数 | 役割 |
|---|---|---|
| Tier 1 | 3 | 初期構築・デプロイ(ワンクリック系) |
| Tier 2 | 7 | 日常の開発タスク |
| Tier 3 | 3 | リファレンス検索 |

各スキルの詳細は[スキルカタログ](skill-catalog.md)を参照。

---

[← 前へ: ヘッドレステスト](../guides/07-headless-testing.md) | [次へ: スキルカタログ →](skill-catalog.md)
