# シミュレーター(Simulator)

> 原文: https://hub.evenrealities.com/docs/reference/simulator
> ※ 本ページは公式ドキュメントの非公式な日本語要約です(要約時点のバージョン: v0.7.2)。

## インストールと起動

```bash
npm install -g @evenrealities/evenhub-simulator
evenhub-simulator [OPTIONS] [targetUrl]
```

macOS / Linux / Windows 対応。

## オプション一覧

| オプション | 説明 |
|---|---|
| `-c`, `--config <path>` | 設定ファイルのパス指定 |
| `-g`, `--glow` | グラス表示のグロー効果を有効化 |
| `--no-glow` | グロー効果を無効化(設定を上書き) |
| `-b`, `--bounce <type>` | バウンスアニメーション: `default` / `spring` |
| `--list-audio-input-devices` | オーディオ入力デバイスを一覧表示 |
| `--aid <device>` | オーディオ入力デバイスを指定 |
| `--no-aid` | デフォルトのオーディオデバイスを使用 |
| `--automation-port <port>` | Headless Automation API を有効化(v0.7.0+) |
| `--print-config-path` | デフォルト設定ファイルパスを表示して終了 |
| `--completions <shell>` | シェル補完を生成(bash / elvish / fish / powershell / zsh) |
| `-V`, `--version` / `-h`, `--help` | バージョン / ヘルプ |

### 設定ファイルの場所

| OS | パス |
|---|---|
| Linux | `$XDG_CONFIG_HOME` または `$HOME/.config` |
| macOS | `$HOME/Library/Application Support` |
| Windows | `C:\Users\<user>\AppData\Roaming` 相当 |

## オーディオ仕様

シミュレーターが発行する `audioEvents`:

- サンプルレート: 16,000 Hz
- フォーマット: 符号付き 16bit リトルエンディアン PCM
- 1 イベントあたり 100ms 分(3,200 バイト / 1,600 サンプル)

## スクリーンショット(v0.5.0+)

グラス表示を RGBA PNG としてエクスポートできる。スクリーンショットボタンでカレントディレクトリにタイムスタンプ付きで保存され、パスが標準出力とインスペクターコンソールに出る。

## Headless Automation API(v0.7.0+)

```bash
evenhub-simulator <url> --automation-port 9898
# → 制御プレーン: http://127.0.0.1:9898
```

### エンドポイント一覧

| エンドポイント | 役割 | レスポンス |
|---|---|---|
| `GET /api/ping` | ヘルスチェック | `pong` |
| `GET /api/screenshot/glasses` | LVGL フレームバッファの 576×288 RGBA PNG | PNG |
| `GET /api/screenshot/webview` | ホスト WebView のキャプチャ(html2canvas、10 秒タイムアウト) | PNG |
| `GET /api/console[?since_id=N]` | コンソールログ取得 | `{ entries, total }` |
| `DELETE /api/console` | コンソールバッファのクリア | — |
| `POST /api/input` | 入力イベント送信 | — |

### コンソール API

キャプチャ対象: `console.*` の呼び出し、未キャッチ例外、未処理の promise rejection、失敗した `fetch`。
`since_id` に前回受け取った最後の `entries[i].id` を指定すると増分取得できる。

### 入力イベント

`POST /api/input` でサポートされるのは **Up / Down / Click / Double Click** の 4 種類。

### 使う上でのコツ

- **スクリーンショット判定は alpha チャンネルで。** 前景も背景も「緑」なので RGB 比較は不正確。`alpha > 0` を点灯ピクセルとして扱う
- **入力のウォームアップ。** 最初のイベントキャプチャコンテナができるまで入力は無視される。app-ready 相当のログを待ってから `POST /api/input` する

エンドツーエンドの実例は[ヘッドレステスト](../guides/07-headless-testing.md)を参照。

## 既知の制限事項

- フォント描画・グレースケールレベルは実機と完全には一致しない(レイアウト検証・ロジックテストには十分)
- リストスクロールのフォーカス位置が実機と異なる場合がある
- 画像処理は実機より高速で、サイズ制限を強制しない
- ステータスイベントは発行されない(ユーザー / デバイス情報はハードコード)
- 異常系のエラーハンドリングは実機と異なる場合がある

> ⚠️ **本番公開前には必ず実機で検証すること。**

---

[← 前へ: even-terminal 調査ノート](../ai-tooling/even-terminal.md) | [次へ: パッケージングとデプロイ →](packaging.md)
