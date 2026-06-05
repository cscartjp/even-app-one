# パッケージングとデプロイ(Packaging & Deployment)

> 原文: https://hub.evenrealities.com/docs/reference/packaging
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## `app.json` マニフェスト

### フィールド一覧(すべて必須)

| フィールド | 型 | ルール |
|---|---|---|
| `package_id` | string | リバースドメイン形式(例: `com.yourname.appname`)。小文字と数字のみ、各セグメントは小文字で開始、最低 2 セグメント、**ハイフン不可** |
| `edition` | string | `"202601"`(現行版) |
| `name` | string | **20 文字以下** |
| `version` | string | Semver の `x.y.z`(例: `"1.0.0"`) |
| `min_app_version` | string | 必要な Even Realities アプリの最小バージョン(例: `"2.0.0"`) |
| `min_sdk_version` | string | 必要な SDK の最小バージョン(例: `"0.0.10"`) |
| `entrypoint` | string | ビルドフォルダからの相対パス(例: `"index.html"`) |
| `permissions` | array | 権限オブジェクトの配列。空配列 `[]` も可 |
| `supported_languages` | array | `en` `de` `fr` `es` `it` `zh` `ja` `ko` のいずれか |

### テンプレート

```json
{
  "package_id": "com.example.g2demo",
  "edition": "202601",
  "name": "G2 Demo",
  "version": "0.1.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.10",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "This app needs to access the network in order to ...",
      "whitelist": ["https://example.com"]
    }
  ],
  "supported_languages": ["en"]
}
```

### permissions の形式

権限は**オブジェクトの配列**(キー・バリューのマップではない)。

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `name` | string | ✓ | `network` / `location` / `g2-microphone` / `phone-microphone` / `album` / `camera` |
| `desc` | string | ✓ | 人間が読める利用理由(1〜300 文字) |
| `whitelist` | string[] | `network` のみ | 許可ドメインのリスト。デフォルト `[]` |

```json
"permissions": [
  {
    "name": "network",
    "desc": "Fetches weather data from the API.",
    "whitelist": ["https://api.weather.com"]
  },
  {
    "name": "g2-microphone",
    "desc": "Enables voice commands for hands-free control."
  }
]
```

> ❌ よくある間違い: `"permissions": { "network": ["example.com"] }` のようなマップ形式は不正。

## ビルドとパッケージング

### Step 1: Web アプリをビルド

```bash
npm run build
```

`dist/`(または `build/`)が生成される。

### Step 2: `.ehpk` にパック

```bash
evenhub pack app.json dist -o myapp.ehpk
```

| 引数 / オプション | 説明 |
|---|---|
| `app.json` | マニフェストへのパス |
| `dist` | **ビルド済み**出力フォルダへのパス |
| `-o myapp.ehpk` | 出力ファイル名(デフォルト: `out.ehpk`) |
| `--no-ignore` | ドットファイルを含める(デフォルトは除外) |
| `-c`, `--check` | `package_id` が Even Hub 上で利用可能か確認 |

## `evenhub pack` のトラブルシューティング

| エラー | 原因と対処 |
|---|---|
| `Invalid package id` | リバースドメイン形式・最低 2 セグメント・小文字開始。大文字・ハイフン・数字始まりは不可(`My-App` ❌ → `com.myname.myapp` ✅、`com.2fast.app` ❌ → `com.twofast.app` ✅) |
| `name: must be 20 characters or fewer` | アプリ名を短くする |
| `version: must be in x.y.z format` | 3 要素の Semver。`"1.0"` や `"v1.0.0"` は不可 |
| `min_app_version / min_sdk_version: expected string, received undefined` | 両方とも必須。文字列で指定する |
| `permissions: each permission must be an object with "name" ...` | オブジェクト配列にして各要素に `name` と `desc` を付ける |
| `supported_languages: invalid language` | 小文字 ISO 形式(`en` `de` `fr` `es` `it` `zh` `ja` `ko`)のみ |
| `Entrypoint file not found` | `entrypoint` で指定したファイルがビルドフォルダ内に実在するか確認 |
| `Project folder not found` | 第 2 引数は実在するディレクトリ。先に `npm run build` を実行 |

## 配布

提出が承認されると Even Hub に掲載され、ユーザーは:

- Even Hub ページから**ダウンロード**
- メニューまたは Even Realities アプリから**起動**

できるようになる。提出要件は[アプリ提出と QA ガイドライン](app-submission.md)を参照。

---

[← 前へ: シミュレーター](simulator.md) | [次へ: CLI →](cli.md)
