# パッケージングとデプロイ（CLI 詳細）

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/packaging.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

## Even Hub CLI（`@evenrealities/evenhub-cli`）

開発とアプリ管理用の公式 CLI。QR コード生成・パッケージング・アカウントログインを提供する。

```bash
npm install -D @evenrealities/evenhub-cli
```

`evenhub` と `eh`（エイリアス）の 2 つのバイナリが入る。ローカルインストール時は `npx evenhub` か npm scripts 経由で使う。

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `evenhub login` | Even Hub 開発者アカウントへのログイン（公開時に必要。メール+パスワード） |
| `evenhub init` | カレントディレクトリにテンプレートの `app.json` を生成 |
| `evenhub qr [options]` | Even App でのサイドロード用 QR コードを生成 |
| `evenhub pack <json> <project>` | ビルド済みアプリを配布用 `.ehpk` にパッケージ |

### `evenhub qr`

スマホの Even App でスキャンする QR コードを生成し、開発サーバーの URL をグラスにロードさせる。

```bash
# URL を直接指定（推奨）
npx evenhub qr --url "http://192.168.0.138:5173"

# パーツから組み立て — 初回は IP を聞かれ、以後キャッシュされる
npx evenhub qr --http --port 5173

# IP 明示（プロンプトなし）
npx evenhub qr --http --ip 192.168.0.138 --port 5173

# キャッシュ済み設定のリセット
npx evenhub qr --clear
```

| オプション | 説明 |
|---|---|
| `--url <url>` | エンコードする完全 URL（他オプションを無視） |
| `--ip <ip>` | IP アドレスまたはホスト名 |
| `--port <port>` | ポート番号 |
| `--http` / `--https` | スキーム（デフォルト: HTTPS） |
| `--path <path>` | URL パス |
| `--external` | QR をターミナルでなく外部プログラムで開く |
| `--clear` | キャッシュされたスキーム・IP・ポート・パスをクリア |

**Tip:** `localhost` や `0.0.0.0` ではなく**マシンのローカルネットワーク IP**（`192.168.x.x` など）を使うこと。スマホがネットワーク越しに dev サーバーへ到達する必要がある。Vite を `--host 0.0.0.0` で起動するとネットワーク URL が表示される。

### `evenhub pack`

ビルド済みアプリを Even Hub ポータル配布用の `.ehpk` にパッケージする。

```bash
npx vite build
npx evenhub pack app.json dist -o myapp.ehpk
```

| オプション | 説明 |
|---|---|
| `<json>` | `app.json` マニフェストのパス（必須） |
| `<project>` | ビルド出力フォルダのパス、例 `dist`（必須） |
| `-o, --output <name>` | 出力ファイル名（デフォルト: `out.ehpk`） |
| `--no-ignore` | 隠しファイル（`.` 始まり）を含める |
| `-c, --check` | パッケージ ID が Even Hub 上で利用可能かチェック |

## `app.json` マニフェスト

すべての Even Hub アプリはプロジェクトルートに `app.json` が必要。パッケージングと Even Hub ポータル向けのアプリ記述:

```json
{
  "package_id": "com.example.myapp",
  "edition": "202601",
  "name": "My app",
  "version": "1.0.0",
  "min_app_version": "0.1.0",
  "tagline": "Even Hub に表示される短い説明",
  "description": "アプリの機能の詳しい説明",
  "author": "Your Name",
  "entrypoint": "index.html",
  "permissions": {
    "network": ["api.example.com"],
    "fs": ["./assets"]
  }
}
```

- **`package_id` のルール:** 有効な逆ドメイン名で、各セグメントは小文字で始まり、小文字と数字のみ。**ハイフン不可**。`com.myname.myapp` は有効、`com.my-name.my-app` は無効
- **`permissions.network`:** アクセスする必要のあるドメインを列挙。ユーザー設定のサーバーに接続するアプリなどは `["*"]` で無制限アクセスを指定できる

## 推奨 npm scripts

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "vite build",
    "qr": "evenhub qr --http --port 5173",
    "pack": "npm run build && evenhub pack app.json dist -o myapp.ehpk"
  }
}
```

## 開発ワークフロー

1. dev サーバー起動: `npm run dev`（ターミナル 1 で起動しっぱなし）
2. QR コード生成: `npm run qr`（ターミナル 2。または `npx evenhub qr --url "http://<自分のIP>:5173"`）
3. スマホの Even App で QR をスキャン
4. アプリがグラスにロードされる — コード変更は Vite のホットリロードが効く

## 本番パッケージング

`npm run pack` でビルドと `.ehpk` 作成を一括実行。

`.ehpk` 形式は将来の Even Hub ポータル提出用（まだ提出機能は未公開）。`*.ehpk` は `.gitignore` に追加しておく。

---

[← 前へ: シミュレーター環境（even-dev）](09-simulator.md) | [目次に戻る](README.md)
