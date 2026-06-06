# even-toolkit 日本語要約

> 原文リポジトリ: https://github.com/fabioglimb/even-toolkit （MIT ライセンス）
> ※ 本セクションはコミュニティ製ライブラリ **even-toolkit** の公式ドキュメント（README + docs/ 4 本）の非公式な日本語要約です。

Even Realities G2 アプリ専用のデザインシステム + コンポーネントライブラリ。**このリポジトリの `app/` は even-toolkit の公式 scaffold（minimal テンプレート）で生成されている**ため、アプリ開発時の一次リファレンスとなる。

- NPM: https://www.npmjs.com/package/even-toolkit
- ライブデモ: https://even-demo.vercel.app
- 要約の基準: v1.7.2 / コミット `d12c232`（2026-06-06 取得）

## なぜ使うのか

- スマホ側 UI（WebView）: Even Realities 2025 UIUX ガイドライン準拠の React コンポーネント 55+ とデザイントークンが揃っており、公式らしい見た目を最短で実現できる
- グラス側: Per-Screen アーキテクチャ・ナビゲーションヘルパー・表示ビルダーなど、素の SDK では自前実装になる定型処理を肩代わりしてくれる
- [ルートページ終了の審査要件](../g2-notes/04-page-lifecycle.md)も `useGlasses` がデフォルトで自動処理する

## 目次

| ページ | 内容 |
|---|---|
| [概要とセットアップ](01-overview.md) | インストール、scaffold CLI（6 テンプレート）、パッケージ構成 |
| [グラス SDK ヘルパー](02-glasses-sdk.md) | Per-Screen アーキテクチャ、ナビゲーション/表示ビルダー、STT（音声認識） |
| [Web コンポーネント](03-components.md) | 55+ コンポーネントのカテゴリ別リファレンス要約 |
| [ページパターン](04-patterns.md) | 設定・リスト・フォーム・ダッシュボード等 8 つの画面テンプレート |
| [テーマとデザイントークン](05-theming.md) | CSS カスタムプロパティ、ライト/ダークテーマ、タイポグラフィ |
| [移行ガイド](06-migration.md) | 既存アプリを toolkit に移行する 7 ステップとマッピング表 |

## 関連ページ

- [even-g2-notes の even-toolkit 紹介](../g2-notes/08-browser-ui.md) — 第三者視点の要約（旧バージョン基準）
- [コミュニティリソース](../resources.md)

---

[← 目次に戻る](../../README.md) | [次へ: 概要とセットアップ →](01-overview.md)
