# even-g2-notes 日本語要約（コミュニティリファレンス）

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/README.md
> ※ 本セクションはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes)（nickustinov 氏）の非公式な日本語要約です。
> 原文自体も公開 SDK の独自調査・リバースエンジニアリングに基づく**非公式情報**であり、Even Realities 公式ドキュメントではありません。不正確な内容を含む可能性があります。

公式ドキュメント（`docs/` の他セクション）には載っていない実践情報が多く含まれる:

- イベント配信の癖（quirks）— `CLICK_EVENT = 0` が `undefined` になる問題など
- 利用可能な Unicode グリフの調査結果（プログレスバー・ゲーム盤面に使える文字）
- 全エラーコードの一覧
- フェイクボタン・選択ハイライトなど実アプリ由来の UI パターン
- 審査リジェクト要件（ルートページのダブルタップ終了）

## 目次

| ページ | 内容 |
|---|---|
| [アーキテクチャ詳解](01-architecture.md) | 接続モデルの実体、WebView ブリッジの仕組み、自動接続、ハードウェア仕様 |
| [ディスプレイと UI 詳解](02-display.md) | コンテナの全プロパティ・制限値、フォントと Unicode グリフ対応、全角文字による等幅ワークアラウンド |
| [入力イベントの癖](03-input-events.md) | イベント型一覧と実機/シミュレーターの挙動差、必読の quirks 6 項目 |
| [ページライフサイクル API](04-page-lifecycle.md) | 各 API の挙動詳細、審査リジェクト要件、`callEvenApp` エスケープハッチ |
| [デバイス API 詳解](05-device-apis.md) | オーディオ PCM 仕様、SDK ストレージの注意点とキャッシュパターン、SDK にないもの一覧 |
| [エラーコード](06-error-codes.md) | 全操作の結果コード、SDK の JSON キー互換性 |
| [実アプリの UI パターン](07-ui-patterns.md) | フェイクボタン、選択ハイライト、画像アプリのイベントキャプチャ、ページめくり |
| [ブラウザ UI（even-toolkit）](08-browser-ui.md) | 設定ページ用コンポーネントライブラリの全エントリポイント・デザイントークン |
| [シミュレーター環境（even-dev）](09-simulator.md) | even-dev の使い方、最小アプリ構成、シミュレーターの制限 |
| [パッケージングとデプロイ](10-packaging.md) | CLI 全コマンド・オプション、app.json スキーマ、開発ワークフロー |

## 例示アプリ（原文より）

| アプリ | 説明 | 参考になる点 |
|---|---|---|
| [demo](https://github.com/nickustinov/demo-app-g2) | SDK 機能ショーケース（全コンテナ型・最大コンテナ数・Unicode グリフ・イベントインスペクター） | **まずここから** |
| [chess](https://github.com/dmyster145/EvenChess) | テスト・リント・モジュラー構成を備えたフルアプリ | 複雑なアプリの構成例 |
| [reddit](https://github.com/fuutott/rdt-even-g2-rddit-client) | `app.json` パッケージング・API プロキシ・evenhub-cli 連携 | パッケージングの実例 |
| [weather](https://github.com/nickustinov/weather-even-g2) | even-toolkit による設定 UI、even-dev 用 vite-plugin.ts | シンプルな実例 |
| [tesla](https://github.com/nickustinov/tesla-even-g2) | Tesla 車両ステータス表示・操作 | 画像ベース描画、バックエンドサーバー |
| [pong](https://github.com/nickustinov/pong-even-g2) | Pong ゲーム | Canvas 描画ゲーム、画像コンテナ |
| [snake](https://github.com/nickustinov/snake-even-g2) | Snake ゲーム | Canvas 描画ゲーム、画像コンテナ |
| [flappy-g2](https://github.com/200even/flappy-g2) | Flappy Bird クローン | タップ操作ゲーム、4bit グレースケール |

---

[← 戻る: コミュニティリソース](../resources.md) | [docs 目次に戻る](../../README.md) | [次へ: アーキテクチャ詳解 →](01-architecture.md)
