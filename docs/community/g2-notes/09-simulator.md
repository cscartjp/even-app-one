# シミュレーター環境（even-dev）

> 原文: https://github.com/nickustinov/even-g2-notes/blob/main/docs/simulator.md
> ※ 本ページはコミュニティ製リファレンス [even-g2-notes](https://github.com/nickustinov/even-g2-notes) の非公式な日本語要約です。原文も独自調査に基づく非公式情報です。

[even-dev](https://github.com/BxNxM/even-dev) は Even Hub Simulator で G2 アプリをビルド・テストするための共有開発環境。アプリの自動検出、依存インストール、Vite dev サーバー設定、シミュレーター起動を一手に引き受ける。

## アプリの実行

```bash
git clone https://github.com/BxNxM/even-dev.git
cd even-dev
npm install
./start-even.sh
```

ランチャーが利用可能なアプリを一覧し選択を促す。直接指定も可能:

```bash
APP_NAME=demo ./start-even.sh        # 名前で選択
APP_PATH=../my-app ./start-even.sh   # ローカルアプリをパスで指定（設定不要）
```

外部アプリは even-dev ルートの `apps.json` に登録できる（git URL は初回実行時に自動 clone）:

```json
{
  "chess": "https://github.com/dmyster145/EvenChess",
  "my-local-app": "../my-local-app"
}
```

## アプリ構造

G2 アプリは普通の Web アプリ。特別なフレームワークや必須インターフェースはなく、HTML + TypeScript + Even Hub SDK だけ。

最小ファイル構成:

```
my-app/
  index.html          <- エントリポイント
  package.json        <- 依存とスクリプト
  vite.config.ts      <- dev サーバー設定
  app.json            <- アプリメタデータ（パッケージング用）
  src/
    main.ts           <- アプリのブートストラップ
    styles.css        <- スタイルシート
```

`package.json` は最低限 SDK と Vite があればよい:

```json
{
  "name": "my-even-app",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5173",
    "build": "vite build"
  },
  "dependencies": {
    "@evenrealities/even_hub_sdk": "^0.0.7"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.3.1"
  }
}
```

`vite.config.ts` は最小限に（`server: { host: true, port: 5173 }` 程度）。

**Tips:**

- **CSS フレームワークは `vite-plugin.ts` 経由で動く** — even-dev はアプリルートの `vite-plugin.ts` を発見して共有 Vite インスタンスに注入する。Tailwind CSS やパスエイリアスはこの仕組みで動かす
- **スタンドアロンを保つ** — アプリは単体の `npm run dev` で動くようにし、even-dev のインフラに依存しないこと
- **バックエンドが必要なら** `server/` ディレクトリに独自の `package.json` を持たせて置く。even-dev が自動検出し Vite と並行起動する
- **ブラウザ設定ページには [even-toolkit](08-browser-ui.md) を使う**

## シミュレーターの制限

`@evenrealities/evenhub-simulator` 0.7.1 時点:

- **5 個以上のコンテナを持つページを拒否する**（実機は 12 個まで OK）
- **200×100 を超える画像コンテナをサポートしない**（実機は 288×144 まで OK、SDK 0.0.10+）

これらは実機グラスでは動作する機能なので、シミュレーターで弾かれても実機テストで確認すること。

## リファレンスアプリ

| アプリ | 説明 | 位置づけ |
|---|---|---|
| [chess](https://github.com/dmyster145/EvenChess) | テスト・リント・モジュラー構成のフルアプリ | 複雑な構成の参考 |
| [reddit](https://github.com/fuutott/rdt-even-g2-rddit-client) | `app.json` パッケージング・API プロキシ・evenhub-cli 連携 | パッケージングの参考 |
| [weather](https://github.com/nickustinov/weather-even-g2) | even-toolkit の設定 UI、even-dev 用 vite-plugin.ts | シンプルな参考 |

---

[← 前へ: ブラウザ UI（even-toolkit）](08-browser-ui.md) | [次へ: パッケージングとデプロイ →](10-packaging.md)
