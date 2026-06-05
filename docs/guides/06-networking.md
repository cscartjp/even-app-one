# ネットワーキング(Networking)

> 原文: https://hub.evenrealities.com/docs/guides/networking
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## 2 つのゲート

本番環境では、すべての HTTP リクエストが**2 つのチェック両方**を通過する必要がある:

1. **Even 側の権限チェック** — 宛先ドメインが `app.json` の `network` 権限の `whitelist` に載っていること(Even Realities アプリが強制)
2. **ブラウザの CORS チェック** — WebView のエンジン(Android: Chromium / iOS: WKWebView)が標準の CORS を強制

> ⚠️ **ホワイトリストは CORS の回避ではない。** `app.json` にドメインを足しても、サーバーが正しい CORS ヘッダーを返さなければブラウザがレスポンスをブロックする。

## ホワイトリストの書き方

```json
"permissions": [
  {
    "name": "network",
    "desc": "Fetches weather data and stores user preferences in the cloud.",
    "whitelist": [
      "https://api.weather.com",
      "https://prefs.example.com"
    ]
  }
]
```

- **オリジン単位で 1 エントリ**。完全なオリジン(`https://api.example.com`)で書く。ホスト名のみ・ワイルドカードは不可
- **本番は HTTPS 必須**。`http://` はローカル開発(LAN の dev サーバーへのサイドロード)のみ
- **実際に使うドメインだけ**書く。未使用エントリは審査でフラグが立つ

## ローカル開発と本番の違い

| 項目 | ローカル開発 | 本番 WebView |
|---|---|---|
| ページオリジン | `http://localhost:5173` | `.ehpk` 読み込み時にアプリが注入するオリジン |
| CORS | 開発プロキシ(Vite proxy 等)で緩和できる | 厳密に適用 |
| ホワイトリスト | サイドロード時はバイパスされる | 強制 |

## 「ローカルでは動くのに実機で失敗する」典型原因

1. **ホワイトリストにドメインがない** → リクエストが WebView の外に出る前にブロック。サーバーにトラフィックは届かない
2. **サーバーに `Access-Control-Allow-Origin` がない** → リクエストは届く(ログに残る)が、ブラウザがレスポンスを破棄
3. **プリフライト(`OPTIONS`)失敗** → `Content-Type: application/json`・カスタムヘッダー・`PUT`/`DELETE` などはプリフライトが飛ぶ。`OPTIONS` を 404 に流してしまう API が多いので注意
4. **混合コンテンツ** → HTTPS オリジンから `http://` への fetch は不可。端から端まで HTTPS にする

## サーバー側に必要な CORS ヘッダー

最低限:

```http
Access-Control-Allow-Origin: *
```

プリフライトが必要なリクエストの場合:

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Max-Age: 86400
```

> 💡 サードパーティ API の CORS 設定を変えられない場合は、**自分の管理下のサーバーで中継**し、そのサーバーのドメインをホワイトリストに載せる。

## デバッグチェックリスト(順番に確認)

1. ドメインが `app.json` の `network.whitelist` にあるか(変更したら再パック・再アップロード)
2. WebView インスペクタ(Even Realities アプリ → 開発者メニュー)のネットワークタブを確認
   - `(blocked)` でステータスコードなし → **ホワイトリスト**の問題
   - ステータスコードはあるがレスポンスが空 / `fetch()` が reject → **CORS** の問題
3. レスポンスの `Access-Control-Allow-Origin` ヘッダーを確認
4. JSON やカスタムヘッダーを送るなら `OPTIONS` プリフライトが 2xx を返すか確認
5. 同じリクエストを `curl` でテスト(curl で成功して WebView で失敗ならほぼ CORS)
6. 同じビルドをシミュレーターでテスト(シミュレーターは CORS は適用されるがホワイトリストは強制されない。シミュレーター成功 + 実機 blocked ならホワイトリスト忘れ)

---

[← 前へ: UI/UX デザインガイドライン](05-design-guidelines.md) | [次へ: ヘッドレステスト →](07-headless-testing.md)
