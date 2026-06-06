# ページパターン

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/docs/patterns.md
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。完全なコード例は原文を参照。

toolkit コンポーネントを組み合わせた典型的な画面構成のテンプレート集。8 パターンが「コピーして使える」フルコードで提供されている。

| パターン | 構成要素 | ポイント |
|---|---|---|
| **設定ページ** | `SettingsGroup` + `ListItem` の `trailing` に `Toggle` / `Select` | グループ単位でラベル分け。「Danger Zone」グループ + `ConfirmDialog variant="danger"` で破壊的操作を分離 |
| **リストページ** | `ScreenHeader`（actions に追加ボタン）→ `SearchBar` → `CategoryFilter` → `ListItem` の列 | 0 件時は `EmptyState` に切り替え。検索中かどうかで EmptyState の文言と CTA を出し分ける |
| **フォームページ** | `NavHeader`（left に戻る）+ `Input` / `Textarea` / `Select` + 送信 `Button` | ラベルは `text-[13px] tracking-[-0.13px] text-text-dim`。送信中は `Button` 内に `<Loading />`、`disabled` で多重送信防止 |
| **詳細ページ** | `NavHeader` → `StatGrid`（ヒーロー統計）→ `SectionHeader` + `Card` の節 → 末尾に全幅 CTA | 「…」ボタン → `BottomSheet` + `CTAGroup layout="stacked"` でアクションシート |
| **ウィザード** | ステップごとの条件レンダリング + 下部固定の `StepIndicator` | `currentStep` / `totalSteps` を渡すだけで Prev/Next と Finish の切り替えを自動処理 |
| **ダイアログフロー** | `Dialog`（アクションメニュー）→ `ConfirmDialog`（確認） | `activeDialog: string \| null` の単一 state でダイアログの連鎖を管理 |
| **ダッシュボード** | `StatCard` のグリッド → `PieChart`（donut）→ `BarChart` → `Timeline` | KPI は 2 カラムグリッド、各チャートは `Card` で包む |
| **チャット / AI** | `NavHeader` + `ChatContainer` + `ChatInput` | `Page className="flex flex-col h-screen"` + `ChatContainer className="flex-1"` で入力欄を下部固定 |

## ストリーミング応答の実装パターン

AI のストリーミング表示は「空の assistant メッセージを `isStreaming: true` で先に追加し、チャンクごとに `content` を追記、完了時に `isStreaming: false`」という流れ:

```tsx
setMessages(prev => [...prev, userMsg, { id, role: 'assistant', content: '', isStreaming: true }]);
for await (const chunk of streamAI(input)) {
  setMessages(prev => prev.map(m => m.id === id ? { ...m, content: m.content + chunk } : m));
}
setMessages(prev => prev.map(m => m.id === id ? { ...m, isStreaming: false } : m));
```

---

[← 前へ: Web コンポーネント](03-components.md) | [次へ: テーマとデザイントークン →](05-theming.md)
