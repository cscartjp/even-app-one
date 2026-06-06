# 移行ガイド

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/docs/migration.md
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。完全なマッピング表は原文を参照。

既存の G2 アプリ（自前 UI コンポーネント持ち）を even-toolkit に移行する手順。新規アプリを scaffold から始める場合は不要だが、**変換マッピング表は toolkit 流の書き方を知るリファレンスとしても有用**。

## 前提条件

- React 18+ / TypeScript / Tailwind CSS v3 or v4
- `class-variance-authority` インストール済み
- git がクリーンな状態

Tailwind 設定では toolkit のコンポーネントパスを `content` に追加し、トークンを Tailwind カラーにマップする（`bg: 'var(--color-bg)'` など。完全な設定例は原文）。

## 7 ステップ（各ステップは独立してデプロイ可能）

| # | 作業 | 目安 |
|---|---|---|
| 1 | ハードコード色をトークン参照に置換（`#fff` → `var(--color-surface)`、`rounded-xl` → `rounded-[6px]`） | 30 分 |
| 2 | プリミティブ置換。優先順: Button → Card → Input/Textarea/Select → Toggle → Badge → Progress | 1–2 時間 |
| 3 | レイアウト置換（自前ヘッダー → `Page` + `ScreenHeader` 等） | 1 時間 |
| 4 | フィードバック置換（ダイアログ・トースト・ローディング・空状態） | 30 分 |
| 5 | 複雑コンポーネント置換（チャート・チャット・カレンダー等） | 1–2 時間 |
| 6 | 置き換え済みのローカルコンポーネントファイルを削除 | 30 分 |
| 7 | クリーンアップ（未使用 CSS/依存の削除、lint・型チェック、手動テスト） | 30 分 |

## 主要マッピング（抜粋）

### 色

| 旧 Tailwind | 新 |
|---|---|
| `bg-white` | `bg-surface` |
| `bg-gray-100` | `bg-surface-light` |
| `text-gray-900` | `text-text` |
| `text-gray-500` | `text-text-dim` |
| `bg-blue-500` / `bg-primary` | `bg-accent` |
| `border-gray-200` | `border-border` |
| `bg-black/50` | `bg-overlay` |

### 角丸・フォント

- `rounded-md` / `rounded-lg` / `rounded-xl` / `rounded-2xl` → **すべて `rounded-[6px]`**（円形は `rounded-full` のまま）
- `text-2xl font-bold` → `text-[24px] tracking-[-0.72px] font-normal`（**bold/semibold は使わない**）

### prop 名の変更（要注意）

| 旧 | 新 | 対象 |
|---|---|---|
| `onClick` | `onPress` | ListItem, Tag, TagCard |
| `onChange`（select イベント） | `onValueChange`（string） | Select |
| `isOpen` | `open` | Dialog, BottomSheet, ConfirmDialog |
| `onDismiss` | `onClose` | Dialog, BottomSheet |
| `isLoading` | children に `<Loading />` を入れる | Button |
| `color="success"` / `"error"` | `variant="positive"` / `"negative"` | Badge |

### コンポーネント名の対応

shadcn/ui 風の自前部品からの対応: `Switch` → `Toggle`、`Chip` → `Pill`、`Tabs` → `SegmentedControl`、`Spinner` → `Loading`、`Modal` → `Dialog`、`Alert` → `Toast`。`cn` ユーティリティも `even-toolkit/web` から import する。

## 検証チェックリスト（要約）

- **見た目**: 角丸はすべて 6px / ハードコード色なし / テキストは 8 サイズのみ / bold 不使用
- **動作**: ボタン・トグル・ダイアログ（オーバーレイクリック + Escape）・検索・空状態
- **import**: ローカル UI 部品の残骸なし、すべて `'even-toolkit/web'` から
- **ビルド**: `tsc --noEmit` 通過、React の二重インスタンスなし（React DevTools で確認）

---

[← 前へ: テーマとデザイントークン](05-theming.md) | [目次に戻る](README.md)
