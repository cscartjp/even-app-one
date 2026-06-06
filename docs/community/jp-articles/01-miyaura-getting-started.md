# Even G2 スマートグラス開発入門 — 環境構築から Hello World まで（miyaura 氏）

> 原文: https://zenn.dev/miyaura/articles/eveng2-part1-getstarted-0ed90d3aa144e8
> ※ 本ページは miyaura 氏による Zenn 記事（2026-03-18 公開 / 2026-04-04 更新）の非公式な要約です。
> シリーズ「Even G2 スマートグラス開発入門」のパート 1。

公式 Quickstart と異なり、コミュニティ製スターター **[even-dev](https://github.com/BxNxM/even-dev)** と高レベル SDK **even-better-sdk** を使った入門手順。Windows（PowerShell）での代替手順も載っている点が特徴。

## Even G2 でできること / できないこと

| できること | できないこと |
|---|---|
| テキスト表示（最大 2,000 文字） | カメラ・スピーカー（非搭載） |
| リスト表示 | テキスト装飾（フォント変更・色・太字） |
| 画像表示（20〜200 × 20〜100 px） | 中央揃え・背景色指定 |
| マイク入力（PCM 16kHz mono） | |
| REST API / WebSocket 通信 | |

開発モデル: PC 上の Vite 開発サーバー → スマホの Even アプリ（WebView 内で実行）→ BLE 経由でグラスに描画命令。

## 前提条件

| ソフトウェア | バージョン |
|---|---|
| Node.js | v18 以上（推奨 v24） |
| npm | v8 以上 |
| Git / Bash / curl | 任意（`start-even.sh` が使用） |

## even-dev のセットアップ

```bash
git clone https://github.com/BxNxM/even-dev.git
cd even-dev
npm install
./start-even.sh
```

`start-even.sh` 実行時の流れ: アプリ選択 → 選択アプリの `npm install` → Vite 開発サーバー起動（`http://127.0.0.1:5173`）→ シミュレーター起動。

### 利用パッケージ

| パッケージ | 役割 |
|---|---|
| `@evenrealities/even_hub_sdk` | コア SDK（ブリッジ接続・イベント・UI 描画） |
| `@evenrealities/evenhub-cli` | CLI（パッケージング・QR コード生成・ログイン） |
| `@evenrealities/evenhub-simulator` | ローカルシミュレーター |
| `@jappyjan/even-better-sdk` | コミュニティ製高レベル SDK（記事では推奨） |
| `@jappyjan/even-realities-ui` | React UI コンポーネント |

### start-even.sh コマンドリファレンス

```bash
./start-even.sh                    # 対話的にアプリを選択
./start-even.sh timer              # アプリ名を直接指定
APP_NAME=timer ./start-even.sh     # 環境変数で指定
APP_PATH=../my-app ./start-even.sh # ローカルの外部アプリを指定
./start-even.sh --web-only timer   # Vite サーバーのみ（シミュレーターなし）
./start-even.sh --sim-only         # シミュレーターのみ
./start-even.sh --update           # 外部アプリを更新
./start-even.sh --devenv-update    # 全依存パッケージを再インストール
./start-even.sh --reset            # キャッシュ・ビルド出力をクリア
./start-even.sh --evenhub-cli --help # evenhub-cli を直接呼び出し
```

## Hello World アプリ

ファイル構成:

```
apps/my-first-app/
├── index.html       ← コンパニオン画面（グラス表示は SDK 経由）
├── package.json
├── app.json         ← マニフェスト（package_id, edition, entrypoint など）
├── vite.config.ts   ← _shared/standalone-vite の createStandaloneViteConfig を利用
└── src/main.ts
```

### even-better-sdk 版（高レベル API）

```typescript
import { EvenBetterSdk } from '@jappyjan/even-better-sdk'

await EvenBetterSdk.getRawBridge()           // 1. ブリッジ接続
const sdk = new EvenBetterSdk()
const page = sdk.createPage('my-page')       // 2. ページ作成

const title = page.addTextElement('Hello, Even G2!')
title
  .setPosition((p) => p.setX(100).setY(80))
  .setSize((s) => s.setWidth(400).setHeight(60))

const info = page.addTextElement('Tap ring to interact')
info
  .setPosition((p) => p.setX(100).setY(160))
  .setSize((s) => s.setWidth(400).setHeight(60))
  .markAsEventCaptureElement()               // この要素がリング入力を受け取る

await page.render()                          // 3. グラスに描画
sdk.addEventListener((event) => { /* R1 リングイベント */ })
```

公式 SDK 版では同じ内容を `TextContainerProperty` ×2 + `createStartUpPageContainer` で記述（`isEventCapture: 1` を片方に付与）。

## シミュレーターでの動作確認

```bash
./start-even.sh my-first-app
# または直接:
npx @evenrealities/evenhub-simulator@latest -b default http://127.0.0.1:5173
```

ブラウザに 576×288px の緑色ディスプレイが表示される。

| グラス操作 | シミュレーター操作 |
|---|---|
| タップ（CLICK） | クリック |
| ダブルタップ（DOUBLE_CLICK） | ダブルクリック |
| スクロール上 / 下 | スクロールアップ / ダウン |

Windows では Bash を `& "C:\Program Files\Git\bin\bash.exe" start-even.sh` で呼ぶか、PowerShell 2 ターミナルで Vite（`npx vite --host 0.0.0.0 --port 5173`）とシミュレーターを個別起動する。

## 実機デバッグ（QR サイドロード）

1. Vite 開発サーバー起動: `./start-even.sh --web-only my-first-app`
2. QR コード生成: `npx @evenrealities/evenhub-cli qr`
3. [Even Hub](https://hub.evenrealities.com/) でアカウント作成 → Settings → Edit profile → Developer name 設定
4. スマホの Even アプリを最新化 → Hub メニュー右上のアカウントボタン → 開発者名 → プロトタイプモード → QR コード読み込み

Vite の **HMR が実機でも有効**で、PC でコードを保存するだけでグラス表示が即時更新される。

### 注意事項

- Vite は必ず `--host 0.0.0.0` で起動（デフォルトの localhost ではスマホからアクセス不可）
- Windows はファイアウォールでポート 5173（TCP）の許可が必要
- PC とスマホは**同じ Wi-Fi** に接続すること

## 関連リンク（原文より）

- even-dev: https://github.com/BxNxM/even-dev
- even-better-sdk: https://www.npmjs.com/package/@jappyjan/even-better-sdk
- シリーズ続編（Part 2 予定）: R1 リングのイベント処理・リスト表示・ページ更新パターン

---

[← 戻る: 日本語記事まとめ目次](README.md) | [次へ: SDK 機能の動作確認メモ（bigdra 氏）→](02-bigdra-sdk-features.md)
