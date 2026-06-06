# Web コンポーネント

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/docs/component-guide.md
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。各コンポーネントの全 props は原文を参照。

スマホ側 WebView の UI（設定ページ等）用 React コンポーネント。すべて `even-toolkit/web` から import:

```tsx
import { Button, Card, ListItem, Toggle } from 'even-toolkit/web';
```

共通事項: 全コンポーネントが `className` を受け付け、ネイティブ HTML 属性を透過する。スタイルはデザイントークン（`var(--color-*)`）参照なのでテーマ変更が全体に効く。

## 1. プリミティブ

| コンポーネント | 用途 | 主な props |
|---|---|---|
| `Button` | アクション全般 | `variant`: highlight（主）/ default / ghost / danger / secondary、`size`: sm / default / lg / icon（36×36） |
| `Card` | コンテンツのグループ化 | `variant`: default / elevated（影付き）/ interactive（ホバー）、`padding`: none / sm / default / lg（0/12/16/24px） |
| `Badge` | ステータスラベル | `variant`: positive / negative / accent / neutral |
| `Input` / `Textarea` | テキスト入力 | ネイティブ属性透過。`Textarea` は `rows`（既定 3） |
| `Select` | 固定リストからの選択 | `options: {value, label}[]`、**`onValueChange`（onChange ではない）** |
| `MultiSelect` | 複数選択（v1.5.0+） | — |
| `Checkbox` / `RadioGroup` | 選択肢 | `RadioGroup` は `direction`: vertical / horizontal |
| `Toggle` | ON/OFF スイッチ（iOS 風） | `checked` / `onChange` |
| `SegmentedControl` | 排他的タブ切り替え | `size`: default / small / xsmall（48/36/24px） |
| `Slider` | 数値レンジ | `min` / `max` / `step` / `leftIcon` / `rightIcon` |
| `Progress` | 進捗バー | `value`（0–100） |
| `StatusDot` | 接続状態ドット | `connected: boolean`（true=緑パルス、false=赤）— グラス接続表示の定番 |
| `Pill` | 削除可能なチップ | `label` / `onRemove` |
| `Skeleton` | ローディングプレースホルダ | `width` / `height` / `rounded` |
| `InputGroup` | 入力 + ボタンの結合 | 子要素の角を連結 |
| `Table` 系 | 構造化データ | `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` の 6 部品 |
| `Kbd` / `Divider` | ショートカット表示 / 区切り線 | `Divider` は `variant="spaced"` で上下 24px |

## 2. レイアウト・ナビゲーション

| コンポーネント | 用途 | 補足 |
|---|---|---|
| `AppShell` | アプリ全体の骨格 | `header` にナビを渡す |
| `DrawerShell` / `useDrawerHeader` | サイドドロワー型ナビ（推奨） | ハンバーガー/戻る自動判定、`bottomItems` で Settings 固定 |
| `Page` | 各画面のルートコンテナ | 最小高さ + 下部余白を確保 |
| `NavBar` | タブバー | `items: {id, label}[]` / `activeId` / `onNavigate` |
| `NavHeader` | 上部バー（中央タイトル + 左右アクション） | サブ画面・詳細画面用 |
| `ScreenHeader` | 大見出し（24px）+ subtitle + actions | 一覧画面の先頭 |
| `SectionHeader` | セクション見出し（20px）+ action | ページ内の区切り |
| `SettingsGroup` | ラベル付き設定グループ | 中に `ListItem` を並べる |
| `ListItem` | 万能リスト行 | `title` / `subtitle` / `leading` / `trailing` / **`onPress`**。スワイプ削除対応 |
| `SearchBar` | 虫眼鏡アイコン付き検索 | — |
| `CategoryFilter` | 水平スクロールのカテゴリボタン列 | — |
| `Tag` / `TagCarousel` / `TagCard` | 選択可能タグ / 横スクロール容器 / カード型タグ | `onPress` |
| `SliderIndicator` / `PageIndicator` / `StepIndicator` | ドット / セグメントバー / ウィザード前後ボタン | `StepIndicator` は最終ステップで自動的に「Finish」表示 |
| `Timeline` | 縦タイムライン | `events: {id, title, subtitle?, timestamp, color?}[]` |
| `StatGrid` / `StatusProgress` | 統計グリッド / 多段進捗 | `StatusProgress` の status: waiting / in-progress / complete / skipped |
| `PagedCarousel` / `CardCarousel` | カルーセル | — |

## 3. フィードバック・オーバーレイ

| コンポーネント | 用途 | 補足 |
|---|---|---|
| `Dialog` | ボトムシート風ダイアログ | `open` / `onClose` / `title` / `actions: {label, onClick, variant?}[]` |
| `ConfirmDialog` | 確認ダイアログ | `variant="danger"` で確認ボタンが赤に |
| `BottomSheet` | 汎用ボトムシート | タイトル・アクションなし、内容は自由 |
| `Toast` | 通知バー | `variant`: info / warning / error / undo |
| `EmptyState` | 空状態プレースホルダ | `title` / `description` / `action`（CTA） |
| `Loading` | ピクセルアート風スピナー | `size`（既定 24） |
| `CTAGroup` | CTA ボタン群 | `layout`: stacked / side-by-side / icon-row |
| `TimerRing` | 円形カウントダウン | `remaining` / `total` / `formatFn` |
| `ScrollPicker` / `DatePicker` / `TimePicker` / `SelectionPicker` | ホイール式ピッカー | — |

## 4. チャット（AI アプリ向け）

`ChatContainer`（スクロールリスト + 固定入力）を軸に、`ChatMessage` 型 1 つで thinking・コードブロック・diff・ツール呼び出し・エラー・コマンドまで描画できる:

```ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  thinking?: string;       // ChatThinking（折りたたみ）
  isStreaming?: boolean;   // ストリーミング中表示
  toolCalls?: ToolCall[];  // ChatToolCall（running/complete/error）
  codeBlocks?: CodeBlock[];
  diff?: string;           // ChatDiff（unified diff の色分け）
  error?: string;
  command?: string;        // ChatCommand（$ プレフィックス）
}
```

`ChatInput` は自動拡張テキストエリア + 送信ボタン（Enter で送信、Shift+Enter で改行）。個別部品（`ChatBubble` / `ChatThinking` / `ChatCodeBlock` / `ChatDiff` / `ChatToolCall` / `ChatCommand` / `ChatError`）も export されている。

## 5. カレンダー・チャート・メディア

| コンポーネント | 用途 | 補足 |
|---|---|---|
| `Calendar` | 月/週/日ビューのカレンダー | controlled / uncontrolled 両対応、`events` / `onEventClick` |
| `Sparkline` | 軸なしインライン折れ線 | `data: number[]` |
| `LineChart` / `BarChart` / `PieChart` | チャート（recharts ベース） | `PieChart` は `donut` + `centerLabel` 対応 |
| `StatCard` | KPI カード | `value` / `change` / `trend`（up/down/neutral）/ `sparklineData` |
| `FileUpload` | ドラッグ&ドロップアップロード | `accept` / `multiple` / `maxSize` |
| `VoiceInput` | マイクボタン + 音声認識 | `onTranscript` / `language` |
| `WaveformVisualizer` | 録音中の波形アニメーション | `active` / `barCount` |
| `ImageGrid` / `ImageViewer` | サムネイルグリッド / ライトボックス | ペアで使う |
| `AudioPlayer` | コンパクトな音声プレイヤー | `src` / `title` |

---

[← 前へ: グラス SDK ヘルパー](02-glasses-sdk.md) | [次へ: ページパターン →](04-patterns.md)
