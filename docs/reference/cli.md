# CLI(evenhub)

> 原文: https://hub.evenrealities.com/docs/reference/cli
> ※ 本ページは公式ドキュメントの非公式な日本語要約です(要約時点のバージョン: v0.1.12)。

## インストール

```bash
# グローバル(推奨)
npm install -g @evenrealities/evenhub-cli

# プロジェクト単位でバージョン固定
npm install -D @evenrealities/evenhub-cli
```

`evenhub` と `eh` は完全に同じコマンド。

```bash
eh login
eh qr --url ...
eh pack app.json dist
```

## コマンド一覧

### `evenhub login` — 開発者アカウント認証

```bash
evenhub login
evenhub login -e your@email.com
```

| オプション | 説明 |
|---|---|
| `-e`, `--email <email>` | アカウントのメールアドレス |

### `evenhub init` — `app.json` の雛形生成

```bash
evenhub init
evenhub init -d ./my-project
evenhub init -o ./config/app.json
```

| オプション | 説明 |
|---|---|
| `-d`, `--directory <dir>` | 作成先ディレクトリ(デフォルト: `./`) |
| `-o`, `--output <path>` | 出力ファイルパス(`--directory` より優先) |

### `evenhub qr` — 開発用サイドロード QR の生成

```bash
# フル URL 指定
evenhub qr --url "http://192.168.1.100:5173"

# 要素ごとに指定
evenhub qr -i 192.168.1.100 -p 5173 --path /my-app

# QR を外部プログラムで開く
evenhub qr --url "http://192.168.1.100:5173" -e
```

| オプション | 説明 |
|---|---|
| `-u`, `--url <url>` | フル URL(指定時は他の URL 系オプションを無視) |
| `-i`, `--ip <ip>` | IP アドレスまたはホスト名 |
| `-p`, `--port <port>` | ポート番号 |
| `--path <path>` | URL パス |
| `--https` / `--http` | スキーム指定(デフォルト: http) |
| `-e`, `--external` | QR コードを外部プログラムで開く |
| `-s`, `--scale <n>` | ファイル出力時のスケール係数(デフォルト: 4) |
| `--clear` | キャッシュ済みのスキーム・IP・ポート・パスをクリア |

Even Realities アプリで QR をスキャンすると、グラスにアプリが読み込まれる(ホットリロード対応)。

### `evenhub pack` — `.ehpk` パッケージ作成

```bash
evenhub pack app.json dist -o myapp.ehpk
```

| 引数 / オプション | 説明 |
|---|---|
| `<json>` | `app.json` マニフェストのパス |
| `<project>` | ビルド出力フォルダ(`dist` / `build` など) |
| `-o`, `--output <file>` | 出力ファイル名(デフォルト: `out.ehpk`) |
| `--no-ignore` | ドットファイルを含める |
| `-c`, `--check` | `package_id` の利用可能性をチェック |

詳細は[パッケージングとデプロイ](packaging.md)を参照。

## シェル補完

```bash
evenhub --completion-bash   # Bash
evenhub --completion-zsh    # Zsh
evenhub --completion-fish   # Fish
```

---

[← 前へ: パッケージングとデプロイ](packaging.md) | [次へ: アプリ提出と QA ガイドライン →](app-submission.md)
