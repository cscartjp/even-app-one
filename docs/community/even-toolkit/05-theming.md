# テーマとデザイントークン

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/docs/theming.md
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。

## 仕組み

`:root` に定義した CSS カスタムプロパティ（デザイントークン）を全コンポーネントが `var(--color-*)` で参照する。アプリ側はトークンを上書きするだけで全体のテーマが変わる。

```css
/* app.css — toolkit のテーマを先に import し、後から上書き */
@import 'even-toolkit/web/theme-light.css';   /* ダークは theme-dark.css */
@import 'even-toolkit/web/typography.css';
@import 'even-toolkit/web/utilities.css';

:root {
  --color-accent: #f0b429;   /* アクセント色だけ変える例 */
}
```

**アクセント色だけ変えるなら最低 3 トークン**: `--color-accent` / `--color-accent-alpha`（12% 透過）/ `--color-text-highlight`（アクセント上の文字色）。

## 主要トークン（ライトテーマ値）

| トークン | ライト値 | 用途（公式ガイドラインの対応） |
|---|---|---|
| `--color-text` | #232323 | 主テキスト（TC-1st） |
| `--color-text-dim` / `--color-text-muted` | #7B7B7B | 副テキスト（TC-2nd） |
| `--color-text-highlight` | #FFFFFF | アクセント背景上のテキスト（TC-Highlight） |
| `--color-bg` | #EEEEEE | ページ背景（BC-3rd） |
| `--color-surface` | #FFFFFF | カード表面（BC-1st） |
| `--color-surface-light` / `-lighter` | #F6F6F6 / #E4E4E4 | ホバー / 無効状態（BC-2nd / BC-4th） |
| `--color-border` / `--color-border-light` | #E4E4E4 / #EEEEEE | ボーダー |
| `--color-accent` / `--color-accent-alpha` | #232323 / rgba 8% | アクセント（BC-Highlight） |
| `--color-accent-warning` | #FEF991 | 警告・アクティブ（黄） |
| `--color-positive` / `--color-negative` | #4BB956 / #FF453A | 成功（緑）/ エラー（赤）+ 各 `-alpha` 版 |
| `--color-overlay` / `--color-input-bg` | rgba(0,0,0,.5) / rgba 8% | ダイアログ背景 / 入力欄背景 |

ダークテーマ（`tokens-dark.css`）は同名トークンを暖色系ダーク（bg #0c0a07、text #f0ebe3、accent #FFFFFF など）で再定義。ダークモード対応は `@media (prefers-color-scheme: dark)` か `.dark` クラスでトークンを上書きする。

## レイアウト・フォントトークン

| トークン | 値 | 用途 |
|---|---|---|
| `--radius-default` | **6px（固定）** | 全コンポーネントの角丸。**8px/12px/16px は使用禁止**（6px はブランドアイデンティティ。例外は丸形要素の `rounded-full` と `Kbd` の 4px のみ） |
| `--spacing-margin` | 12px | ページ左右マージン |
| `--spacing-card-margin` | 16px | カード内パディング |
| `--spacing-same` | 6px | 同種要素間のギャップ |
| `--spacing-cross` | 12px | 異種要素間のギャップ |
| `--spacing-section` | 24px | セクション間 |
| `--font-display` / `--font-body` | FK Grotesk Neue | 見出し・本文（フォントファイルは自前で配信し `@font-face` 定義） |
| `--font-mono` | SF Mono ほか | 等幅 |

## タイポグラフィ（8 クラス）

`font-bold` / `font-semibold` は使わない（400 か 300 のみ）。サイズごとに負のレタースペーシングが対応。**この 8 サイズ以外を作らない**こと。

| クラス | サイズ/ウェイト/トラッキング | 用途 |
|---|---|---|
| `.text-vlarge-title` | 24px / 400 / -0.72px | 画面タイトル |
| `.text-large-title` | 20px / 400 / -0.6px | セクション見出し |
| `.text-medium-title` | 17px / 400 / -0.17px | カードタイトル・ボタン |
| `.text-medium-body` | 17px / 300 / -0.17px | 大きめ本文 |
| `.text-normal-title` | 15px / 400 / -0.15px | リスト行タイトル |
| `.text-normal-body` | 15px / 300 / -0.15px | 標準本文 |
| `.text-subtitle` | 13px / 400 / -0.13px | キャプション・補助 |
| `.text-detail` | 11px / 400 / -0.11px | タイムスタンプ・微細ラベル |

Tailwind ではクラスでなくインライン指定が多用される（例: `text-[13px] tracking-[-0.13px] text-text-dim`）。

## テーマ実例

- **Even Market**: ゴールド `#f0b429`（gold 上は暗い文字 `--color-text-highlight: #1a1a1a`）
- **Even Kitchen**: `document.documentElement.style.setProperty('--color-accent', color)` でレシピごとに動的変更
- **Even Browser**: ブルー `#3b82f6`

---

[← 前へ: ページパターン](04-patterns.md) | [次へ: 移行ガイド →](06-migration.md)
