# Even G2 いじりあれこれ — 実践知見集（gpsnmeajp 氏）

> 原文: https://zenn.dev/gpsnmeajp/scraps/beb45043a2d731
> ※ 本ページは gpsnmeajp 氏による Zenn スクラップ（2026-05-09 時点の内容）の非公式な要約です。
> スクラップ形式で随時更新されているため、最新の内容は原文を参照してください。

3 記事の中で最も網羅的な実践知見集。実機特有の罠、審査ガイドラインの詳解、ネットワーク制限の回避策、リバースエンジニアリングや PC 直接接続といった応用まで扱う。

## SDK 開発での罠・実機挙動（最重要）

### シミュレーター ≠ 実機

- シミュレーターで安定していても**実機では死ぬ**ことがある
- シミュレーターのレンダリング・画像転送は爆速、実機は目に見えて遅い
- 開発中に繰り返し開くとキャッシュで正常表示される — **本当のテストはクリーン状態で**

### 通信・コンテナ

- スマホとの BLE 通信は随時切れる前提で設計する
- グラスアプリ再起動後のコンテナ新規作成は引っかかる（乱数名 or rebuild で対策）
- 起動直後の重い処理（画像転送など）→ 読み込み失敗・グラス再起動の原因
- 文字の連続転送はクラッシュの可能性。バックグラウンド移行でタイマーが不安定化
- 画像コンテナ最大 4、テキストコンテナ最大 8

### UI 表現の限界と代替手段

- カスタムフォント・絵文字なし（一部 Unicode シンボルのみ）
- 中央揃えなし → スペースで代用。装飾なし → 重ね描きで疑似太字
- レイヤー / ウィンドウなし。スクロール以外の上下操作不可（見えないテキストコンテナで代用）
- 1 行コンテナの高さを約 37px にするとスクロールが消える
- 罫線は `─` の連続を `textContainerUpgrade` で描く

### イベントの癖

- タップは `CLICK_EVENT` ではなく `eventType == undefined` で届く（`CLICK_EVENT = 0` の falsy 問題。[g2-notes の quirks](../g2-notes/03-input-events.md) と同事象）
- `FOREGROUND_ENTER_EVENT` / `FOREGROUND_EXIT_EVENT` が反転していたという報告あり

### IMU の電力消費

- `ImuReportPace.P1000`（1 秒間隔）でも **10 分で 10% バッテリー消費**
- 常時待機は非現実的 → R1 リング活用や条件付き起動が必須
- シミュレーター非対応

### ログ取得

スマホ側コンソールを見る手段がないため、`console.log` / `warn` / `error` をオーバーライドして画面内の要素に書き出すのが定石（`[EvenAppBridge]` / `[Simulator]` プレフィックスは除外する）。

### グラス再起動

両テンプルを **5 回連続タップ** → ピッ音 → 再起動。

## フォント寸法測定

G2 はプロポーショナルフォントのため、動的ページングでは文字幅の計測が必要。公式が LVGL フォントレンダリングを再現するライブラリを提供:

- npm: `@evenrealities/pretext`（公式 AI Skill `font-measurement` に対応）
- 行高 **27px**（テキストコンテナ高 = 行数 × 27）、リスト項目 **40px**（コンテナ高 = 項目数 × 40 + 2 × padding）
- グリフ解決は 3 段階フォールバック（Latin → Cyrillic/Greek → CJK）
- `paddingLength` / `borderWidth` 設定時は計測前に寸法から差し引くこと（怠るとスクロールが出る）

## 外部通信の制限と回避策

- HTTPS のみ。マニフェストの**ドメイン完全一致**（ワイルドカード不可）
- **QR サイドロード時は無制限、ストア配布時に格段に厳しくなる**
- すべてのリクエストは 2 つのゲートを通過する必要がある:
  1. Even 権限チェック（`app.json` の network whitelist）
  2. ブラウザの CORS チェック（リモート側の `Access-Control-Allow-Origin`）
  - ⚠️ **whitelist は CORS の回避手段ではない**

### 回避策

| 手段 | ポイント |
|---|---|
| localhost 通信 | 制限なし。スマホ内 WebSocket もコンパニオンアプリ経由で可 |
| Tailscale | MagicDNS + HTTPS Certificates で自宅サーバーに HTTPS 接続 |
| ngrok / Tailscale Funnel / Cloudflare Tunnel | 外部公開。ngrok は `ngrok-skip-browser-warning` ヘッダーで警告ページ回避 + 最低限の認証必須 |

### CORS トラブルの典型原因

whitelist 未記載 / `Access-Control-Allow-Origin` なし / `OPTIONS` プリフライト失敗 / Mixed Content（HTTPS WebView から http へはアクセス不可）。

## スマホロック・バックグラウンド対策（Discord 公式回答より）

スマホロック中・Even アプリがバックグラウンドの状態でもアプリは応答し続ける必要がある（審査要件でもある）。公式の推奨実装:

1. 起動ソース（`appMenu` / `glassesMenu`）を早期に検知
2. `visibilityState === 'hidden'` と `pagehide` イベントで Hidden / Background を判定
3. Hidden Launch 専用の軽量フロー: テキスト先行表示 → image-container 作成と画像転送を遅延 → 最初の成功後のみリッチ表示に復元
4. UI が固まって見えてもバックエンドは健全な場合がある。Hidden WebView 内の timer throttling が原因のことが多い

## 審査ガイドライン詳解（2026-04-22 版）

公式の [アプリ提出と QA ガイドライン](../../reference/app-submission.md) の補足となる詳細。

### app.json 要件

| 項目 | 仕様 |
|---|---|
| `package_id` | リバースドメイン・小文字・ハイフン / アンダースコア不可・2 セグメント以上 |
| `edition` | `"202601"`（現行版） |
| `name` | 20 文字以内。**"Even" を含めない**（なりすまし防止で自動却下） |
| `version` | semver（`v` プレフィックス不可） |
| `min_sdk_version` | 必須。最低 `"0.0.10"` |
| `permissions` | name + desc（1〜300 字）。network は whitelist 必須 |
| `changelog` | 新版提出時は空不可 |

### 動作要件（抜粋）

- アイコンは判読可能・モノクロ / グレースケール限定（カラーは却下）。Foreground & Background 両方設定
- 初回起動で**ブラックスクリーン厳禁**。セットアップが必要ならグラス上に操作説明を表示。設定は localStorage に保持（毎回要求は禁止）
- スマホロック + バックグラウンドで応答必須。2 分放置後も生存。タイマー等の長時間タスクは継続・完了すること
- **終了処理**: ルートページのダブルタップで `bridge.shutDownPageContainer(1)`（システム終了ダイアログ表示）。Mode 0（即時終了）は不許可
- ライフサイクル: `ABNORMAL_EXIT (6)` / `SYSTEM_EXIT (7)` → クリーンアップ、`FOREGROUND_EXIT (5)` → 一時停止 / フラッシュ、`FOREGROUND_ENTER (4)` → 再開
- コンテンツ: 医療診断・金融アドバイス・緊急ルーティング禁止。NSFW・ヘイト表現禁止

### 提出前チェック（原文より）

```bash
evenhub pack app.json dist -o myapp.ehpk -c
```

1. スマホロック 5 分間の QR サイドロード → 生存確認
2. ルートダブルタップ → システム終了ダイアログ表示確認
3. ファーストパーティアプリ再起動 → グラス再起動不要を確認
4. プライバシーポリシーが全 permission をカバーしているか確認

### アプリ更新時のキャッシュ問題

更新が反映されない場合: 右上からアンインストール → マイページを抜ける → 再開で再インストール。localStorage（認証キー等）は維持される。

## 開発フロー・サイドロードのまとめ

1. Even Hub で開発者登録（Even アプリと同じメールアドレス）→ Settings → Developer name 設定
2. Even アプリ → 右上アイコン → マイプラグイン → 自分の名前 → プロトタイプモード有効化
3. `npx evenhub qr` の QR コード読み込みで WebView 起動
4. 配布: `npm run build` → `app.json` 整備 → `npx evenhub pack app.json ./dist/` → Hub にアップロード

著者の最小サンプル: [gpsnmeajp/g2_helloworld](https://github.com/gpsnmeajp/g2_helloworld)（任意テキスト表示 + WebSocket 通信）

## 応用トピック

### MacroDroid 連携（Android）

MacroDroid でスマホ内に HTTP サーバーを立てると、Even Hub アプリから **localhost アクセス（通信制限なし）** で GPS・通知・SMS・SSH などスマホのほぼ全機能に到達できる。サンプル: [gpsnmeajp/g2_macrodroid](https://github.com/gpsnmeajp/g2_macrodroid)

### PC 直接接続（Mentra OS ベース）

スマホを介さず Windows / Mac / Linux から BLE で直接接続する手法:

- [gpsnmeajp/men-g2-ble-gateway](https://github.com/gpsnmeajp/men-g2-ble-gateway) — PC と G2 を REST + WebSocket で直接対話（オフライン動作可）
- [gpsnmeajp/men-g2-atoms3-hello](https://github.com/gpsnmeajp/men-g2-atoms3-hello) — M5Stack (AtomS3) との直接接続例

### リバースエンジニアリング情報

公式スタンスは「手伝えないが止めもしない」（ただしファームウェア改変の気配には即対応）。主要リポジトリ:

| リポジトリ | 内容 |
|---|---|
| `even-g2-protocol` | 通信プロトコル解析 |
| `g2-kit-unofficial` | 公式アプリからの proto ファイル抽出 |
| `droidbridge` | 上記を使ったブリッジ |

技術メモ: チェックサムは CRC-32C/Castagnoli（非反射・init=0・xorout=0）、Windows BLE は極めて不安定、画像転送は非常に遅い。**成果物はファームウェアバージョン依存**（数週間ごとに更新されるため追従負担が大きい）。

---

[← 前へ: SDK 機能の動作確認メモ（bigdra 氏）](02-bigdra-sdk-features.md) | [目次に戻る](README.md)
