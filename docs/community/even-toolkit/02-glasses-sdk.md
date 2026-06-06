# グラス SDK ヘルパー

> 原文: https://github.com/fabioglimb/even-toolkit/blob/main/README.md （Glasses SDK / STT セクション）
> ※ 本ページは [even-toolkit](https://github.com/fabioglimb/even-toolkit)（MIT・コミュニティ製）公式ドキュメントの非公式な日本語要約です。

グラス側（576×288px ディスプレイ）の開発で素の SDK だと自前実装になる部分を肩代わりするヘルパー群。`useGlasses` / `useFlashPhase` / `useSTT` 以外は **React 不要**で使える。

## Per-Screen アーキテクチャ（v1.4〜）

グラスの 1 画面 = 1 ファイルで、表示（`display`）と入力処理（`action`）を同じ場所に書く設計。

```
src/glass/
  shared.ts              — Snapshot 型 + actions インターフェース
  selectors.ts           — 画面ルーター（配線は 3 行）
  splash.ts              — スプラッシュ画像 + ローディングテキスト
  AppGlasses.tsx         — useGlasses フックのセットアップ
  screens/
    home.ts              — { display, action }
    detail.ts            — { display, action }
```

### 画面の定義

```ts
import type { GlassScreen } from 'even-toolkit/glass-screen-router';
import { buildScrollableList } from 'even-toolkit/glass-display-builders';
import { moveHighlight } from 'even-toolkit/glass-nav';

export const homeScreen: GlassScreen<MySnapshot, MyActions> = {
  display(snapshot, nav) {
    return {
      lines: buildScrollableList({
        items: snapshot.items,
        highlightedIndex: nav.highlightedIndex,
        maxVisible: 5,
        formatter: (item) => item.title,
      }),
    };
  },
  action(action, nav, snapshot, ctx) {
    if (action.type === 'HIGHLIGHT_MOVE') {
      return { ...nav, highlightedIndex: moveHighlight(nav.highlightedIndex, action.direction, snapshot.items.length - 1) };
    }
    if (action.type === 'SELECT_HIGHLIGHTED') {
      ctx.navigate(`/item/${snapshot.items[nav.highlightedIndex].id}`);
      return nav;
    }
    return nav;
  },
};
```

### 画面の配線

```ts
import { createGlassScreenRouter } from 'even-toolkit/glass-screen-router';

export const { toDisplayData, onGlassAction } = createGlassScreenRouter({
  'home': homeScreen,
  'detail': detailScreen,
}, 'home');
```

`useGlasses` フックに `getSnapshot` / `toDisplayData` / `onGlassAction` / `deriveScreen` / `splash` を渡して接続する（実例はこのリポジトリの `app/src/glass/AppGlasses.tsx`）。`shutdownOnHomeBack` がデフォルト `true` で、[ルートページのダブルタップ終了という審査要件](../g2-notes/04-page-lifecycle.md#審査要件-ルートページのダブルタップで終了ダイアログを出す)を自動処理する。

## ナビゲーションヘルパー（`glass-nav`)

| 関数 | 動作 |
|---|---|
| `moveHighlight(current, 'up'/'down', max)` | 0〜max でクランプした上下移動 |
| `clampIndex(index, buttonCount)` | ボタン数にクランプ |
| `calcMaxScroll(totalLines, slots)` | 最大スクロールオフセット |
| `wrapIndex(current, dir, count)` | 端でループする移動 |

## 表示ビルダー（`glass-display-builders`)

- `buildScrollableList({ items, highlightedIndex, maxVisible, formatter })` — スクロールインジケータ付きのハイライトリスト
- `buildScrollableContent({ title, actionBar, contentLines, scrollPos })` — ヘッダー + スクロール本文
- 定数: `G2_TEXT_LINES`（10 行）、`DEFAULT_CONTENT_SLOTS`（glassHeader の下に 7 行）

## モードエンコード（`glass-mode`)

複数のナビゲーションモードを 1 つの `highlightedIndex` に詰め込む:

```ts
const mode = createModeEncoder({ buttons: 0, scroll: 100, links: 200 });
mode.getMode(150);          // 'scroll'
mode.getOffset(150);        // 50
mode.encode('scroll', 25);  // 125
```

## ルートマッピング（`glass-router`)

```ts
const deriveScreen = createScreenMapper([
  { pattern: '/', screen: 'home' },
  { pattern: /^\/item\/[^/]+$/, screen: 'detail' },
], 'home');
const extractId = createIdExtractor(/^\/item\/([^/]+)/);
const homeTiles = getHomeTiles(appSplash);
```

## コアモジュール一覧

| import パス | 主なエクスポート |
|---|---|
| `even-toolkit/useGlasses` | `useGlasses<S>()` フック（React） |
| `even-toolkit/useFlashPhase` | `useFlashPhase(active)` フック（React） |
| `even-toolkit/bridge` | `EvenHubBridge` クラス |
| `even-toolkit/types` | `line()`, `separator()`, `glassHeader`, `DisplayData` ほか |
| `even-toolkit/action-bar` | `buildActionBar()`, `buildStaticActionBar()` |
| `even-toolkit/action-map` | `mapGlassEvent(event)` — タップ/ダブルタップ/スクロールを `GlassAction` に変換 |
| `even-toolkit/gestures` | デバウンス + タップ後スクロール抑制 |
| `even-toolkit/keyboard` | `bindKeyboard(dispatch)` — シミュレーター用キーバインド |
| `even-toolkit/glass-format` | `formatGlassHeader()`, `formatGlassListRow()` |
| `even-toolkit/glass-chat-display` | `renderChatBlocks()`, `renderChatReadMode()` |
| `even-toolkit/text-utils` | `truncate()`, `applyScrollIndicators()` ほか |
| `even-toolkit/text-clean` / `paginate-text` | G2 向けテキスト整形・ワードラップ・ページ分割 |
| `even-toolkit/layout` | `DISPLAY_W` (576), `DISPLAY_H` (288), タイル/スロット定数 |
| `even-toolkit/canvas-renderer` / `png-utils` / `composer` | Canvas 描画 → PNG エンコード → ページ合成 |
| `even-toolkit/splash` | `createSplash()`, `TILE_PRESETS` |
| `even-toolkit/keep-alive` | `activateKeepAlive()` / `deactivateKeepAlive()` |
| `even-toolkit/storage` | ブリッジ経由の永続化ヘルパー（`waitForEvenAppBridge()` フロー使用、browser localStorage には依存しない） |
| `even-toolkit/timer-display` | `renderTimerLines()`, `renderTimerCompact()` |
| `even-toolkit/sdk-wrapper` / `box-drawing` | SDK ラッパー・罫線描画 |

対応範囲: テキスト 10 行 / text・columns・chart・home の各ページモード / 画像タイル最大 288×144。

## 音声認識（STT）

プロバイダ非依存の speech-to-text モジュール。

```tsx
import { useSTT } from 'even-toolkit/stt/react';

const { transcript, isListening, start, stop } = useSTT({
  provider: 'soniox',
  language: 'en-US',          // BCP-47
  apiKey: 'your-key',
  vad: { silenceMs: 2500 },   // 無音で自動停止
  chunkIntervalMs: 4000,      // 逐次文字起こし間隔
  continuous: false,
});
```

- プロバイダ: README に記載があるのは `soniox`（クラウド・リアルタイムストリーミング・API キー必要）。パッケージには `stt/providers/whisper-api` と `stt/providers/deepgram` のエントリポイントも存在する
- 音声ソースは自動検出: **グラスのマイク**（G2 ブリッジの `audioControl` 経由）→ ブラウザマイク（`getUserMedia`）→ カスタム `AudioSource`

---

[← 前へ: 概要とセットアップ](01-overview.md) | [次へ: Web コンポーネント →](03-components.md)
