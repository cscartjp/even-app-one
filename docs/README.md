# Even Hub 日本語リファレンス（非公式）

[Even Realities](https://www.evenrealities.com/) のスマートグラス **Even G2** 向けアプリ開発プラットフォーム「Even Hub」の公式ドキュメントを、日本語で要約・解説した非公式リファレンスです。

> ⚠️ **免責事項**
> このドキュメントは個人の学習メモとして公式ドキュメントを独自に要約・解説したものであり、Even Realities 社とは一切関係ありません。
> 内容の正確性は保証されません。SDK・CLI・仕様は頻繁に更新されるため、**正確な最新情報は必ず[公式ドキュメント](https://hub.evenrealities.com/docs/getting-started/overview)を参照してください**。

## 目次

### はじめに（Getting Started)

| ページ | 内容 |
|---|---|
| [概要](getting-started/01-overview.md) | Even Hub と G2 開発の全体像 |
| [インストール](getting-started/02-installation.md) | SDK / シミュレーター / CLI の導入 |
| [はじめてのアプリ](getting-started/03-first-app.md) | 最小限のプラグインを作って動かす |
| [アーキテクチャ](getting-started/04-architecture.md) | Cloud / Phone / Glasses の接続モデル |

### ガイド(Guides)

| ページ | 内容 |
|---|---|
| [ページライフサイクル](guides/01-page-lifecycle.md) | 画面の生成・更新・破棄の流れ |
| [入力とイベント](guides/02-input-events.md) | タッチパッド・リング・IMU のイベント処理 |
| [ディスプレイと UI システム](guides/03-display-ui.md) | 576×288 / 4bit 緑階調のコンテナ UI |
| [デバイス API](guides/04-device-apis.md) | オーディオ / IMU / デバイス情報 / ストレージ |
| [UI/UX デザインガイドライン](guides/05-design-guidelines.md) | グラス向け UI 設計の原則とパターン |
| [ネットワーキング](guides/06-networking.md) | ホワイトリストと CORS の二重ゲート |
| [ヘッドレステスト](guides/07-headless-testing.md) | シミュレーター自動化と CI 連携 |

### AI ツール（AI Tooling)

| ページ | 内容 |
|---|---|
| [Claude Code プラグイン](ai-tooling/claude-code.md) | 公式プラグイン everything-evenhub |
| [スキルカタログ](ai-tooling/skill-catalog.md) | 13 スキルの一覧と使い分け |

### リファレンス(Reference)

| ページ | 内容 |
|---|---|
| [シミュレーター](reference/simulator.md) | 起動オプションと Headless Automation API |
| [パッケージングとデプロイ](reference/packaging.md) | app.json スキーマと .ehpk 作成 |
| [CLI](reference/cli.md) | evenhub コマンド全リファレンス |
| [アプリ提出と QA ガイドライン](reference/app-submission.md) | 審査チェックリスト |

### コミュニティ(Community)

| ページ | 内容 |
|---|---|
| [コミュニティリソース](community/resources.md) | サードパーティ製ツール・Discord |
| [even-g2-notes 日本語要約](community/g2-notes/README.md) | コミュニティ製リバースエンジニアリングリファレンスの要約（全 10 ページ）。イベントの癖・Unicode グリフ対応・UI パターンなど公式にない実践情報 |
| [even-toolkit 日本語要約](community/even-toolkit/README.md) | G2 専用デザインシステム + コンポーネントライブラリ（MIT）の公式 docs 要約（全 6 ページ）。**`app/` はこの toolkit の scaffold で生成** |

## 原文

- 公式ドキュメント: https://hub.evenrealities.com/docs/getting-started/overview
- 各ページ末尾に対応する原文 URL を記載しています
- 要約の基準日: 2026-06-06

### コミュニティリファレンス（community/g2-notes/）

- 原文リポジトリ: https://github.com/nickustinov/even-g2-notes （非公式・リバースエンジニアリングベース）
- 要約の基準コミット: `e71a14d`（2026-06-06 取得）

### コミュニティリファレンス（community/even-toolkit/）

- 原文リポジトリ: https://github.com/fabioglimb/even-toolkit （MIT ライセンス）
- 要約の基準: v1.7.2 / コミット `d12c232`（2026-06-06 取得）
