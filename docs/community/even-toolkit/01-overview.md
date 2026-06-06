# 概要とセットアップ

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/README.md
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。

## インストール

```bash
npm install even-toolkit
```

ピア依存（Web コンポーネントを使う場合のみ必須）: `react` 18+ / `react-router` 7+ / `clsx` / `tailwind-merge` / `class-variance-authority`。グラス側ヘルパーだけなら React なしでも使える（`useGlasses` / `useSTT` フックを除く）。

## scaffold CLI（新規アプリ生成）

```bash
npx even-toolkit my-app
# または
npx @even-toolkit/create-even-app my-app --template minimal
```

`--template`（`-t`）でテンプレートを指定でき、Package ID は対話で入力（デフォルト `com.<appname>.g2`）。

| テンプレート | 内容 |
|---|---|
| **minimal** | AppShell + NavHeader のクリーンなスターター |
| **dashboard** | チャート・統計・タイムライン付きダッシュボード |
| **notes** | 検索・カテゴリ・CRUD 付きノートアプリ |
| **chat** | 音声入力付き AI チャット |
| **tracker** | カレンダー・タイマー・進捗の活動トラッカー |
| **media** | オーディオプレイヤー・アップロード付きギャラリー |

全テンプレート共通: React 19 + React Router 7 + Tailwind CSS v4 + even-toolkit + G2 グラス SDK 統合（スプラッシュ・表示レンダリング・ジェスチャー）+ TypeScript / Vite。

> **注意（このリポジトリでの実例）**: minimal テンプレートには `app.json` が含まれないため別途用意が必要。また生成される `package.json` の `even_hub_sdk` が `^0.0.9`（= 0.0.9 固定）と古いので、`^0.0.10` 以上へ更新すること（toolkit のピア要件は `>=0.0.10`）。

## パッケージ構成

| エントリポイント | 内容 |
|---|---|
| `even-toolkit/web` | React コンポーネント 55+（Tailwind CSS ベース、モバイルファースト） |
| `even-toolkit/web/icons` | ピクセルアートアイコン 191 個（32×32 グリッド・2×2px 単位・7 カテゴリ） |
| `even-toolkit/web/theme-*.css` | デザイントークン（ライト/ダーク）・タイポグラフィ・ユーティリティ |
| `even-toolkit/*`（glasses 系） | グラス側ヘルパー群 → [グラス SDK ヘルパー](02-glasses-sdk.md) |
| `even-toolkit/stt` | プロバイダ非依存の音声認識モジュール → [同上](02-glasses-sdk.md#音声認識stt) |

アイコンの import 例:

```tsx
import { IcChevronBack, IcTrash, IcSettings } from 'even-toolkit/web/icons/svg-icons';
<IcChevronBack width={20} height={20} />
```

カテゴリ: Edit & Settings (32) / Feature & Function (50) / Guide System (20) / Menu Bar (8) / Navigate (23) / Status (54) / Health (12)。名前ベース描画用のレジストリ（`Icon`, `registerIcons` など）もある。

## ナビゲーションパターン（スマホ側 UI の骨格）

- **DrawerShell（推奨）**: サイドドロワーナビゲーション。ハンバーガー/戻るボタンの自動判定、ネスト画面用の `useDrawerHeader`（`backTo` / `right` / `below` / `footer` / `hidden`）、Settings 等を固定する `bottomItems` を備える
- **NavBar + AppShell**: シンプルなアプリ向けの水平タブバー

## SDK 0.0.9+ 対応

- 画像最大サイズ 288×144
- IMU 制御: `bridge.imuEnable()` / `bridge.imuDisable()`
- 起動元検出: `LaunchSource` 型
- `borderRadius` のスペル修正に追随

## even-toolkit で構築されたアプリ（実例）

| アプリ | 内容 | URL |
|---|---|---|
| EvenDemo | コンポーネントショーケース | https://even-demo.vercel.app |
| EvenMarket | リアルタイム株価表示 | https://even-market.vercel.app |
| EvenKitchen | レシピ管理・調理ステップ | https://even-kitchen.vercel.app |
| EvenWorkout | ワークアウト記録・休憩タイマー | https://even-workout.vercel.app |
| EvenBrowser | テキストベースの Web ブラウジング | https://even-browser.vercel.app |

---

[← 目次](README.md) | [次へ: グラス SDK ヘルパー →](02-glasses-sdk.md)
