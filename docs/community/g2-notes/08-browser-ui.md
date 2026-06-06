# ブラウザ UI（even-toolkit）

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/browser-ui.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

WebView 内で動く設定/構成ページ（グラスのディスプレイではない方）用の UI には **[even-toolkit](https://github.com/fabioglimb/even-toolkit)** を使う。Even Realities G2 アプリ専用に作られたデザインシステム + コンポーネントライブラリで、React コンポーネント 55+、ピクセルアートアイコン 191 個、デザイントークン、グラス SDK ブリッジを含む。

- NPM: https://www.npmjs.com/package/even-toolkit
- デモ: https://even-demo.vercel.app
- ライセンス: MIT

## セットアップ

```bash
npm install even-toolkit
```

アプリのエントリポイントでテーマ CSS を import:

```css
@import "even-toolkit/web/theme-light.css";
@import "even-toolkit/web/typography.css";
@import "even-toolkit/web/utilities.css";
```

ダークテーマは `even-toolkit/web/theme-dark.css`。

## エントリポイント

### Web コンポーネント

```typescript
import { Button, Card, NavBar, ListItem, Toggle, AppShell } from 'even-toolkit/web';
```

個別コンポーネントの深い import も可（例: `even-toolkit/web/button`）。

### アイコン

```typescript
import { IcChevronBack, IcTrash, IcSettings } from 'even-toolkit/web/icons/svg-icons';
```

アイコンレジストリ（`even-toolkit/web/icons`）は名前ベース描画用に `Icon`, `registerIcon`, `registerIcons`, `registerAllIcons`, `getIconNames` を提供。

### グラス SDK ブリッジ

| import パス | エクスポート |
|---|---|
| `even-toolkit` | types / action-bar / text-utils / timer-display / gestures / text-clean / paginate-text の再エクスポート |
| `even-toolkit/types` | `LineStyle`, `DisplayLine`, `DisplayData`, `line()`, `separator()`, `ColumnData`, `ImageTileData`, `PageMode`, `GlassActionType`, `GlassAction`, `GlassNavState` |
| `even-toolkit/bridge` | `EvenHubBridge` クラス、`ColumnConfig` 型 |
| `even-toolkit/useGlasses` | `useGlasses<S>()` フック。[ルートページ終了の審査要件](04-page-lifecycle.md#審査要件-ルートページのダブルタップで終了ダイアログを出す)を `shutdownOnHomeBack`（デフォルト `true`、モード `1`）で自動処理 |
| `even-toolkit/useFlashPhase` | `useFlashPhase(active)` フック |
| `even-toolkit/action-bar` | `buildActionBar()`, `buildStaticActionBar()` |
| `even-toolkit/action-map` | `mapGlassEvent(event)` — `EvenHubEvent` を `GlassAction \| null` にマップ |
| `even-toolkit/gestures` | `tryConsumeTap()`, `isScrollSuppressed()`, `notifyTextUpdate()`, `isScrollDebounced()` |
| `even-toolkit/keyboard` | `bindKeyboard(dispatch)` — クリーンアップ関数を返す |
| `even-toolkit/timer-display` | `TimerState`, `renderTimerLines()`, `renderTimerCompact()` |
| `even-toolkit/text-utils` | `truncate()`, `SCROLL_UP`, `SCROLL_DOWN`, `buildHeaderLine()`, `applyScrollIndicators()` |
| `even-toolkit/layout` | `DISPLAY_W` (576), `DISPLAY_H` (288), タイル/スロット/コンテナ定数, `dummySlot()` |
| `even-toolkit/canvas-renderer` | `getCanvas()`, `drawToCanvas()`, `renderToImage()` |
| `even-toolkit/composer` | `composeStartupPage()`, `composeRebuildPage()` |
| `even-toolkit/png-utils` | `encodeTilesBatch()`, `resetTileCache()`, `canvasToPngBytes()` |
| `even-toolkit/keep-alive` | `activateKeepAlive()`, `deactivateKeepAlive()` |
| `even-toolkit/splash` | `createSplash()`, `TILE_PRESETS`, `SplashConfig`, `SplashHandle` |
| `even-toolkit/text-clean` | `cleanForG2()`, `normalizeWhitespace()` |
| `even-toolkit/paginate-text` | `wordWrap()`, `paginateText()`, `pageIndicator()` |

## コンポーネント（55+）

| カテゴリ | 主なコンポーネント |
|---|---|
| プリミティブ | `Button`, `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Checkbox`, `RadioGroup`, `Slider`, `Skeleton`, `Progress`, `StatusDot`, `Pill`, `Toggle`, `SegmentedControl`, `Table` 系, `Kbd`, `Divider` |
| レイアウト | `AppShell`, `Page`, `NavBar`, `NavHeader`, `ScreenHeader`, `SectionHeader`, `SettingsGroup`, `ListItem`（スワイプ削除対応）, `SearchBar`, `Tag` 系, `PageIndicator`, `StepIndicator`, `Timeline`, `StatGrid` |
| フィードバック | `TimerRing`, `Dialog`, `ConfirmDialog`, `Toast`, `EmptyState`, `Loading`, `BottomSheet`, `ScrollPicker`, `DatePicker`, `TimePicker`, `SelectionPicker` |
| チャート | `Sparkline`, `LineChart`, `BarChart`, `PieChart`, `StatCard`（recharts ベース） |
| メディア | `Chat` 系（`ChatContainer`, `ChatBubble`, `ChatInput` ほか）, `Calendar`, `FileUpload`, `VoiceInput`, `WaveformVisualizer`, `ImageGrid`, `ImageViewer`, `AudioPlayer` |

## アイコン（191 個）

ピクセルアートアイコンが 7 カテゴリ（Edit & Settings 32 / Features 40 / Guide 20 / Health 12 / Menu 8 / Navigation 23 / Status 56）。各アイコンは PascalCase の React コンポーネント（例: `IcEditTrash`, `IcFeatCalendar`, `IcStatusBluetooth`）。`IcTrash`, `IcChevronBack`, `IcSettings` など 11 個の便利エイリアスもある。

## デザイントークン（CSS カスタムプロパティ）

主要なもの（ライトテーマ値。ダークテーマは同名プロパティで定義）:

| トークン | ライト値 | 用途 |
|---|---|---|
| `--color-text` | #232323 | 主テキスト |
| `--color-text-dim` | #7B7B7B | 副テキスト |
| `--color-bg` | #EEEEEE | ページ背景 |
| `--color-surface` | #FFFFFF | カード/コンテナ表面 |
| `--color-border` | #E4E4E4 | 主ボーダー |
| `--color-accent` | #232323 | 主アクセント |
| `--color-positive` | #4BB956 | 成功/接続中 |
| `--color-negative` | #FF453A | エラー/警告 |
| `--radius-default` | 6px | 角丸 |
| `--spacing-margin` | 12px | 外側マージン |
| `--spacing-section` | 24px | セクション間隔 |
| `--font-display` | FK Grotesk Neue, ... | 表示/本文フォント |
| `--font-mono` | SF Mono, ... | 等幅フォント |

他に `--color-text-muted` / `--color-text-highlight` / `--color-surface-light(er)` / `--color-border-light` / `--color-accent-alpha` / `--color-accent-warning` / `--color-positive-alpha` / `--color-negative-alpha` / `--color-overlay` / `--color-input-bg` / `--spacing-card-margin` (16px) / `--spacing-same` (6px) / `--spacing-cross` (12px) など。

## タイポグラフィ

`typography.css` の CSS クラス:

| クラス | サイズ | ウェイト | トラッキング |
|---|---|---|---|
| `.text-vlarge-title` | 24px | 400 | -0.72px |
| `.text-large-title` | 20px | 400 | -0.6px |
| `.text-medium-title` | 17px | 400 | -0.17px |
| `.text-medium-body` | 17px | 300 | -0.17px |
| `.text-normal-title` | 15px | 400 | -0.15px |
| `.text-normal-body` | 15px | 300 | -0.15px |
| `.text-subtitle` | 13px | 400 | -0.13px |
| `.text-detail` | 11px | 400 | -0.11px |

---

[← 前へ: 実アプリの UI パターン](07-ui-patterns.md) | [次へ: シミュレーター環境（even-dev）→](09-simulator.md)
