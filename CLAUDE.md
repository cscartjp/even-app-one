# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Command Rules

- NEVER use grep
- ALWAYS use rg (ripgrep)
- NEVER use find
- ALWAYS use fd

## Search Commands

grep is forbidden.

Always use:

- rg instead of grep
- fd instead of find

Reason:
grep is not installed on this machine and commands will fail.

## 保護ファイル（上書き禁止）

- **`app/preview/design-mock.html` は UI デザインの正本（手作りモック・読み取り専用 chmod 444）**
- このファイルへの書き込み・cp・再生成出力は禁止。`bun run preview:screens` の出力先は `app/preview/index.html` のみ
- デザイン変更はユーザーの明示承認後に chmod で解除してから行う

## リポジトリの目的

Even Realities のスマートグラス **Even G2** 向けアプリ（Even Hub プラグイン）を開発する個人の趣味プロジェクト。Even Realities 社とは無関係（非公式）。

現状は **`docs/` の日本語リファレンスのみでアプリコードは未作成**。今後このリポジトリ内にアプリを追加していく予定。

## everything-evenhub プラグイン

このリポジトリでは Even Realities 公式の Claude Code プラグイン **everything-evenhub** を導入済み。G2 アプリの作業では対応するスキルを必ず使うこと:

- 新規アプリの雛形: `quickstart` / `template`
- UI 構築: `glasses-ui`、入力処理: `handle-input`、デバイス機能: `device-features`
- テスト: `test-with-simulator` / `simulator-automation`
- API 検索: `sdk-reference` / `cli-reference` / `design-guidelines`
- ビルド・公開: `build-and-deploy`

スキルの使い分け詳細は `docs/ai-tooling/skill-catalog.md` を参照。

## Even Hub アプリの基本構造（docs の要点）

- **アプリの実体はスマートフォン上の WebView で動く**。グラスはディスプレイ表示と入力イベント発行のみ（`docs/getting-started/04-architecture.md`）
- 構成は「標準的な Vite + TypeScript の Web プロジェクト + `app.json` マニフェスト」。Even 固有の依存は `@evenrealities/even_hub_sdk` の 1 つだけ
- ディスプレイは **576×288px・4bit 緑階調**。CSS/DOM はなく「コンテナ」方式（画像最大 4、その他最大 8、必ず 1 つに `isEventCapture: 1`）。詳細は `docs/guides/03-display-ui.md`
- ネットワークは `app.json` ホワイトリスト **と** サーバー側 CORS の両方が必要（`docs/guides/06-networking.md`）

### CLI（アプリ作成後に使用）

`evenhub` と `eh` は同一コマンド（`@evenrealities/evenhub-cli`）:

```bash
evenhub init                          # app.json 雛形生成
evenhub qr --url "http://<ip>:5173"   # 実機サイドロード用 QR（ホットリロード対応）
evenhub pack app.json dist -o app.ehpk # 配布パッケージ作成
```

## docs/ の執筆規約

`docs/` は公式ドキュメント（https://hub.evenrealities.com/docs/）の非公式日本語要約。編集時は既存ページの形式に揃える:

1. 冒頭に `> 原文: <URL>` と非公式要約である旨の注記
2. 末尾に `[← 前へ](...) | [次へ →](...)` のナビゲーションリンク
3. ページを追加・削除したら `docs/README.md` の目次も更新
4. 内容を公式から取り直した場合は `docs/README.md` の「要約の基準日」を更新
