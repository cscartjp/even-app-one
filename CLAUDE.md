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

## バージョン表示付きアプリの作業ルール（必読）

以下のアプリは画面にアプリ版（app.json の `version`）を表示する仕組みを持つ。
**これらのアプリのコードを変更する作業を始める前に、必ず該当 `app.json` の `version` を確認し、patch を 1 つ上げてから作業する**（特別な指示がない限り）。

- 例: `0.0.1` → `0.0.2`、`0.2.3` → `0.2.4`
- 対象アプリ:
  - `apps/hisho/app.json`（ステータスバーに `HISHO v<version>`）
  - `apps/g2hermes/app.json`（ヘッダーに `G2 Hermes v<version>`）
- ユーザーが具体的な version を指定した場合（例: minor/major を上げる、特定値にする）はそれに従う。

仕組み（共通）: `app.json` の `version` を `vite.config.ts` の `define` で `__APP_VERSION__` として build 時にリテラル注入し、画面コードが `appVersion()` 経由で表示する。Vite を介さない実行（`bun test`）は `'0.0.0-dev'` にフォールバックする。

## 配布ビルド・パッケージング規約（.ehpk / 絶対厳守）

`.ehpk` 配布パッケージを作るときは、以下を**毎回**守る。過去に worktree でビルドして ENV 欠落の壊れた .ehpk を配布した事故あり（2026-06-10）。

1. **`.env` のある場所でビルドする。** `apps/<app>/.env`（例 g2hermes の `VITE_BRIDGE_BASE` / `VITE_BRIDGE_TOKEN`）は **gitignore 済み**。git worktree には追跡ファイルしか入らないため `.env` が存在せず、Vite が `import.meta.env.VITE_*` を **undefined のまま焼き込み、実機で接続エラーになる**。
   - worktree でビルドするなら build 前に必ず `cp <main checkout>/apps/<app>/.env apps/<app>/.env`（gitignore 済みでコミットされない）。または **main チェックアウト側でビルドする**。
2. **手順は build → pack の順。** `bun run build`（= `tsc -b && vite build`、ここで ENV と `__APP_VERSION__` を注入）→ `evenhub pack app.json dist -o <name>.ehpk`。`dist/` を作らず pack するのは禁止。
3. **CLI は `evenhub`（グローバル `~/.bun/bin/evenhub`）を直接呼ぶ。`npx evenhub` は禁止**（npm の別パッケージ `evenhub` を 404 で引く）。
4. **pack 前後に bundle 検証を必ず行う（grep で判定）。**
   - ENV: `rg -o "<実 BASE 値, 例 100.64.0.1:8787>" dist/assets/*.js` がヒットすること。**警告文字列 `VITE_BRIDGE_BASE / VITE_BRIDGE_TOKEN が未設定です` は常に bundle に含まれる**ので、これの有無で判定してはいけない。実値で見る。
   - version: `rg -o "<x.y.z>" dist/assets/*.js` がヒットすること（app.json 由来なので ENV と無関係に通る → 「version が入っているから OK」と誤判定しない）。
   - build ログに `VITE_BRIDGE_BASE / VITE_BRIDGE_TOKEN が未設定です` の警告が出ていないこと。

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
