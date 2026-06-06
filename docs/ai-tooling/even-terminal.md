# even-terminal（Terminal Mode ホスト CLI）調査ノート

> ※ 本ページは `@evenrealities/even-terminal` **v0.8.1** の dist ソースを直接読んだ**独自調査ノート**です（公式ドキュメントの要約ではありません）。調査日: 2026-06-06。バージョンアップで内容が変わる可能性があります。

Even G2 の Terminal Mode（アプリ v2.2.0 で追加）のホスト側 CLI。グラス/スマホから Claude Code / Codex を操作するためのローカルサーバーを立てる。

## 基本情報

- パッケージ: `@evenrealities/even-terminal`（npm のみで配布、**クローズドソース**）
  - `package.json` に repository フィールドなし。[even-realities の GitHub org](https://github.com/even-realities) にもリポジトリなし → **公開 Issue トラッカーが存在しない**。フィードバック窓口は実質 Even Realities Discord のみ
- リリース履歴: 0.6.5 (2026-04-25) → 0.7.7 (05-06) → 0.7.9 (05-19) → 0.8.1 (2026-06-05)。約2週間間隔
- ローカルのインストール先: `~/.local/share/mise/installs/node/24/lib/node_modules/@evenrealities/even-terminal/`
- このマシンでは `glasses` コマンド（`~/.local/bin/glasses`）で起動するのが定番（Tailscale + 固定トークン + `/tmp/even-terminal.log`）

## 起動オプション（`even-terminal start`）

| オプション | 内容 |
|---|---|
| `--provider claude\|codex` | デフォルト AI プロバイダ。**唯一の「モード」系オプション**。スマホ側から API パラメータでセッションごとの切替も可 |
| `-p, --port` | ポート（デフォルト 3456） |
| `-t, --token` | 認証トークン（デフォルト自動生成） |
| `-n, --name` | クライアント表示名 |
| `-d, --cwd` | セッションの作業ディレクトリ |
| `--tailscale` / `-i <if>` | Tailscale IP / 指定インターフェースの IP を使用 |
| `--expose pinggy\|bore\|ngrok` | 一時的な公開トンネル |
| `--log-file` / `--verbose` | ログ出力 |

**モデル指定・permission mode 指定のフラグは存在しない**（v0.8.1 時点）。

## 内部実装の要点（v0.8.1）

### Claude プロバイダ（`dist/claude/session.js`）

Agent SDK の `query()` に以下を**ハードコード**で渡している:

```js
model: "claude-opus-4-6",          // ← 固定。settings.json や環境変数では上書き不可
permissionMode: "acceptEdits",     // ← 固定
maxTurns: 50,
settingSources: ["user", "project"],  // CLAUDE.md・フックは効く
```

- 2026-06-05 リリースの最新 0.8.1 でも `claude-opus-4-6` のまま（初版 0.6.5 リリース時の最新モデル。更新が追いついていないだけと思われる）
- ツール承認レイヤー（`canUseTool`）:
  - `Read` / `Edit` / `Glob` / `Grep` / `Agent` / `WebSearch` / `WebFetch` 等 → 自動許可
  - `Bash` → `ls` / `cat` / `git status` 等の読み取り系のみ自動許可、それ以外は**グラス/スマホへ承認確認を送信**
  - 一度「常に許可」したツールはセッション内で自動許可

### Codex プロバイダ（`dist/codex/`）

- `codex app-server --listen <url>` を lazy-spawn して WebSocket(JSON-RPC) で接続
- `turn/start` に**モデルを渡していない** → **`~/.codex/config.toml` のデフォルト model / reasoning effort がそのまま効く**

## モデルを変えたい場合の選択肢

1. **Codex プロバイダを使う**（一番素直）: `glasses --provider codex` で起動し、`~/.codex/config.toml` でモデル・effort を調整
2. **dist を直接パッチ**: `dist/claude/session.js` 内の `"claude-opus-4-6"` を書き換える（1箇所）。`glasses` 再起動で反映。**npm 更新で消える**ので都度再パッチ
3. **コミュニティ製代替**: [claude-code-g2](https://github.com/sam-siavoshian/claude-code-g2) — 公式 Terminal Mode とは別系統（Even Hub アプリ + ローカルバックエンド）。`~/.cc-g2/config.json` で `model` / `permissionMode` を自由に設定可能。Whisper 音声入力対応（OpenAI API キー必要）。`claude` CLI 経由なので Max サブスク課金
4. **要望を出す**: Even Realities Discord の Terminal Mode チャンネル

## 運用メモ

- npm 版にはブラウザ用 Web UI は同梱されない（URL+token はスマホアプリ用 API）。進捗確認はログ tail:
  `tail -f /tmp/even-terminal.log | rg --line-buffered -o '"summary":"[^"]*"|"state":"[a-z_]+"'`
- グラス発のセッションは通常の Claude Code セッションとして保存される → 完了後 `claude --resume <id>` で引き継ぎ可（実行中の resume は破損リスクあり）
- グラス HUD はツール実行中ずっと「Thinking」表示のままになるが正常動作

---

[← 前へ: スキルカタログ](skill-catalog.md) | [次へ: シミュレーター →](../reference/simulator.md)
