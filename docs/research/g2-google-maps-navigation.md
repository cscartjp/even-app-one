# Google Maps API で G2 ナビを作る — 研究ノート

> このページは Even G2 上でナビゲーション表示を実現する方法を検証した**研究ノート**（非公式・社内メモ）です。
> 2026-06-29 に Google Maps Platform の実 API を叩きながら調査した結果をまとめています。
> Google Maps Platform の仕様・料金は頻繁に変わるため、数値は必ず[公式](https://developers.google.com/maps/billing-and-pricing/pricing)で再確認してください。

## 結論（先に）

- **「Google マップの画面をグラスにミラーリングする API」は存在しない。** 自作アプリで「ルート情報を取得して自前で描く」のが唯一の道。
- ナビに必要な Google API は **Routes API（ルート計算）＋ Geocoding API（地名→緯度経度）の2つだけ**。
- G2 本番表示の本命は **テキストのターンバイターン**（矢印＋距離＋交差点名）。地図画像は条件付きで補助的に使える。
- **G2 で重要なのは「色」ではなく「輝度コントラスト」。** 画像は 4bit グレースケールを作るだけで、緑はハードが発光する色。地図を出すなら「簡略化＋高コントラスト（暗い地図＋明るいルート線）」が必須。

---

## 1. Google Maps Platform の全体像

「Google Maps API」という単一 API はなく、用途別に約30個の API が3グループに分かれる。ナビで使うのは2つだけ。

| グループ | 役割 | ナビでの用途 |
|---|---|---|
| **Routes** | 2地点間のルート計算 | 現在地→目的地の道順・距離・曲がる指示 |
| **Places / Geocoding** | 住所/地名 ⇄ 緯度経度 | 目的地の地名を座標に変換 |
| ~~Maps~~ | 地図描画 | **G2では使わない**（DOM/Canvas が無い） |
| ~~Navigation SDK~~ | フルのターンバイターン地図UI埋め込み | Enterprise級・高額・**G2不可** |

---

## 2. Routes API（現行・推奨）

### Directions API（旧）は使わない

| | Directions API（旧・Legacy） | **Routes API（新・推奨）** |
|---|---|---|
| 状態 | Legacy（動くが新機能なし） | 現行・GA |
| 方式 | `GET` | `POST`（JSON body） |
| エンドポイント | `maps.googleapis.com/maps/api/directions` | `routes.googleapis.com/directions/v2:computeRoutes` |
| 渋滞考慮 | 限定的 | `TRAFFIC_AWARE` 対応 |

新規開発は **Routes API 一択**。

### リクエスト

`POST https://routes.googleapis.com/directions/v2:computeRoutes`

- ヘッダ `X-Goog-Api-Key: <APIキー>`
- ヘッダ `X-Goog-FieldMask: <欲しいフィールド>` … **必須**。欲しいフィールドを明示しないとエラー。課金額の抑制も兼ねる。
- body は出発地・目的地・移動手段の JSON。

```bash
# .env の GOOGLE_APIKEY を読み込む前提（apps/g2hermes/.env など gitignore 下に置く）
curl -sS -X POST 'https://routes.googleapis.com/directions/v2:computeRoutes' \
  -H 'Content-Type: application/json' \
  -H "X-Goog-Api-Key: $KEY" \
  -H 'X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.polyline.encodedPolyline' \
  -d '{
    "origin":      { "location": { "latLng": { "latitude": 33.5902, "longitude": 130.4017 } } },
    "destination": { "location": { "latLng": { "latitude": 33.5897, "longitude": 130.4205 } } },
    "travelMode":  "WALK",
    "languageCode": "ja-JP",
    "units": "METRIC"
  }'
```

- `travelMode`: `WALK` / `DRIVE` / `BICYCLE` / `TWO_WHEELER` / `TRANSIT`
- `languageCode: "ja-JP"` で **instructions が日本語で返る**（翻訳不要）

### レスポンス（ターンバイターンの中身）

`routes[].legs[].steps[]` の各 step に以下が入る。これがナビ表示の3点セット。

```json
{
  "navigationInstruction": {
    "maneuver": "TURN_RIGHT",                 // 矢印の向き
    "instructions": "祇園町西（交差点）を右折して はかた駅前通り に入る"
  },
  "distanceMeters": 816                        // その区間の距離
}
```

- `routes[0].distanceMeters` / `routes[0].duration`（例 `"1742s"`）でルート全体の距離・時間。
- 一部の step は `navigationInstruction` を持たない（曲がりのない接続区間）→ 距離を足し込んで「○○m直進」に畳む処理が要る。
- `instructions` は長い（道路名込み）→ G2 の1行に収まらないので **交差点名だけ抽出 or 折り返し**の整形が必要。

### maneuver → 矢印の対応（抜粋）

| maneuver | 矢印 | maneuver | 矢印 |
|---|---|---|---|
| `DEPART` / `STRAIGHT` | ↑ | `TURN_RIGHT` | ↱ |
| `TURN_LEFT` | ↰ | `TURN_SLIGHT_RIGHT` | ↗ |
| `TURN_SLIGHT_LEFT` | ↖ | `ROUNDABOUT_*` | ⟳ |
| `UTURN_*` | ↩ | `RAMP_*` / `MERGE` | ⤴ |

※ G2 は使える Unicode が限られる（絵文字・カスタムフォント不可）。矢印は**自前で図形を描く（PNG画像 or 太線ポリゴン）**のが確実。

---

## 3. Geocoding API（目的地入力）

G2 は文字入力ができないので、目的地は**音声 or プリセット**から取り、地名を Geocoding API で座標化する。

`GET https://maps.googleapis.com/maps/api/geocode/json?address=博多駅&language=ja&key=<KEY>`
→ `results[0].geometry.location.{lat,lng}` を Routes API の destination に渡す。

---

## 4. Maps Static API（経路の静的画像）

ルートを地図画像にできる。**polyline を線として重ねられる。**

`GET https://maps.googleapis.com/maps/api/staticmap`

主なパラメータ:

- `size=200x100`（G2 画像コンテナ上限に合わせる）, `scale=2`（高精細化）
- `path=color:0x000000ff|weight:6|enc:<encodedPolyline>` … Routes API の `routes[0].polyline.encodedPolyline` をそのまま渡す
- `markers=color:green|label:S|<lat,lng>` … 始点/終点ピン
- `style=feature:all|element:labels|visibility:off` … **ラベル全消し**（G2ではノイズ源）
- `style=feature:poi|visibility:off` … POI消し

```bash
curl -sS -G 'https://maps.googleapis.com/maps/api/staticmap' \
  --data-urlencode "size=200x100" --data-urlencode "scale=2" \
  --data-urlencode "style=feature:all|element:labels|visibility:off" \
  --data-urlencode "style=feature:poi|visibility:off" \
  --data-urlencode "style=feature:road|element:geometry|color:0xcccccc" \
  --data-urlencode "style=feature:landscape|color:0xf5f5f5" \
  --data-urlencode "path=color:0x000000ff|weight:6|enc:${POLY}" \
  --data-urlencode "key=${KEY}" -o route_min.png
```

> ⚠️ **Maps Static API は別 API。** プロジェクトで有効化し、API キーの「API の制限」リストにも追加が必要（さもないと `403 not authorized`）。キー制限の反映には数分かかることがある（一過性の 403 を観測）。

---

## 5. 料金（2026-06 時点・趣味用途ならほぼ無料）

2025年3月の改定で**旧「月 $200 クレジット」は廃止 → API ごとの月間無料枠**に変更。

| API | 月間無料枠 | 超過後 |
|---|---|---|
| Routes（Compute Routes Essentials） | **10,000 回/月** | $5 / 1,000回 |
| Geocoding | **10,000 回/月** | $5 / 1,000回 |
| Maps Static | **10,000 回/月** | $2 / 1,000回 |

個人テストなら無料枠内。ただし **billing（クレカ登録）有効化は必須**。

---

## 6. ★ G2 画像表示の知見（今回の核心）

### 公式仕様（`docs/guides/03-display-ui.md`）

| 項目 | 仕様 |
|---|---|
| キャンバス全体 | 576×288px |
| 色 | **4bit 階調(16レベル)の緑色のみ** |
| **画像コンテナのデータサイズ** | **安全値 幅 20–200px / 高さ 20–100px**（出典で差異あり・下記注） |
| 画像の色 | **4bit 階調（グレースケール）** |

> **画像サイズ上限は出典で食い違う**：SDK 型定義 (`index.d.ts`) の上限は **288×144**、公式 docs 要約は **200×100**。本リポジトリは両方を満たす**安全側交差の 200×100** を採用（`docs/spec/ui-lab-sandbox.md` 参照）。新規実装も **200×100 を上限**にしておくのが無難。
| 画像コンテナ数 | 最大 4 |
| 画像データ送出 | `createStartUpPageContainer` 時は不可 → 生成後に `updateImageRawData` |

### 検証で分かったこと

1. **「緑」はアプリが作るものではない。** アプリが用意するのは **16階調グレースケール**。緑はハードウェアの発光色。→ 設計時はグレースケールで考えればよく、画像を「緑にする」必要はない。
2. **消える/見えるを分けるのは輝度コントラスト。**
   - ❌ 失敗：ルートを**緑線**で描き地図も緑化 → 線と地図の輝度が同じで**同化して消える**。
   - ✅ 成功：地図を**簡略化（ラベル/POI off・薄く）**＋ルートを**黒太線**＋必要なら**反転（暗い地図＋明るいルート）** → くっきり見える。緑発光の実機でも黒線（低輝度）は残る。
3. **1枚の画像は実質 200×100px（安全値）。** 全画面（576×288）に地図を貼ることはできない。地図は「街区レベルの概観」止まり。
4. **実機ではちらつく**（ファーム仕様）。細い背景の道は特にチラつくので、**太いルート線が一番安定して見える**要素になる。
5. **AR的には「背景は暗く、情報だけ光る」が基本。** 地図も反転して暗背景にするとシースルー性・省電力・視認性が良い。

### G2 で地図画像を出すための3条件

1. **簡略化**：`style=` でラベル・POI を全消し
2. **高コントラスト**：ルートは黒/明の太線、地図の地物は薄く
3. **割り切り**：1枚 200×100px（概観のみ。詳細は無理）

---

## 7. 推奨アーキテクチャ

```
① 目的地（音声 or プリセット）
        │  Geocoding API
② 目的地 lat/lng
        │
③ 現在地 ← SDK getAppLocation()（Hishoで実績あり / navigator.geolocation はNG）
        │  Routes API computeRoutes
④ legs[].steps[] のターンバイターン
        │  現在地が次stepに近づくたび表示更新
⑤ G2描画（テキスト主役＋概観地図は任意）
```

### G2 画面レイアウト案（576×288）

```
┌────────────── 576 × 288 ──────────────┐
│  ↱ 右折                  ┌──────────┐  │  ← テキスト(本命・常に明瞭)
│                          │ 概観地図 │  │     + 概観地図(任意・200×100)
│  816 m 先                │ 200×100  │  │       暗背景+明ルート線
│  祇園町西 交差点          └──────────┘  │
│  → はかた駅前通り                       │
│  ──────────────────────────────────    │
│  博多駅まで  2.0 km ・ 約 29 分          │
└────────────────────────────────────────┘
```

**テキストのターンバイターンが必須・主役。概観地図は「あれば嬉しい」補助。** チラつき・サイズ・規約を考えると、まずはテキストだけで出すのが堅実。

---

## 8. 実機への落とし込み

- **GPS**：SDK `getAppLocation()`（ネイティブ Bridge 経由）。WebView の `navigator.geolocation` はブロックされる。
- **画像送出**：地図 PNG は **even-toolkit の `canvasToPngBytes` で 4bit indexed PNG バイト列**に変換して `updateImageRawData` で送る（生画素値は非表示になる）。
- **通信2ゲート**：`app.json` の network whitelist に `routes.googleapis.com` / `maps.googleapis.com` を**ドメイン完全一致**で追加 ＋ リモート側 CORS（Google 側は対応済みのはず・要検証）。
- **APIキー秘匿**：WebView に直書きすると漏洩前提。**Bridge サーバー経由で叩く**か、リファラ/API 制限をかける。

---

## 9. 未解決・次の課題

- [ ] 目的地入力 UI（音声認識 or プリセット）の設計
- [ ] 移動追従：現在地が動くたびに表示 step を進めるロジック（再フェッチ頻度とコスト）
- [ ] `routes.googleapis.com` が WebView（ブラウザ）から直接叩けるか＝CORS 実検証（ダメなら Bridge 必須）
- [ ] APIキーの秘匿方法の確定（Bridge 経由 vs リファラ制限）
- [ ] **Google Maps Platform 利用規約の確認**：地図画像を Google 以外の画面（グラス）に表示・キャッシュする点はグレー〜要確認。自分用テストは可、配布は要精査。テキストのターンバイターンは規約上安全側。
- [ ] maneuver 全種の矢印アイコン（PNG）整備

---

## 10. 再現コマンド（このセッションで実行した手順）

1. Google Cloud で **Routes API / Geocoding API / Maps Static API** を有効化し、API キーを発行（キー制限を3つの API に絞る）。
2. キーを `apps/g2hermes/.env` の `GOOGLE_APIKEY=` に置く（gitignore 下）。
3. シェルでキーを読み込む（値は表示しない）:
   ```bash
   KEY=$(sed -n 's/^GOOGLE_APIKEY[[:space:]]*=[[:space:]]*//p' apps/g2hermes/.env | head -1)
   KEY="${KEY%$'\r'}"; KEY="${KEY%\"}"; KEY="${KEY#\"}"
   ```
4. §2 の curl で Routes（ターンバイターン＋polyline）取得。
5. §4 の curl で polyline を重ねた Static Map を取得。
6. PIL で 200×100・16階調へ量子化し、グレースケール／緑のプレビューを生成（プレビュー画像は Google 地図データを含むため**リポジトリにはコミットしない**＝ToS 配慮。コマンドから随時再生成する）。

---

## 参考リンク

- [Routes API & Geocoding 料金（公式）](https://developers.google.com/maps/billing-and-pricing/pricing)
- [Compute Route Directions（公式）](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Routes API への移行（公式）](https://developers.google.com/maps/documentation/routes/migrate-routes-why)
- [2025年3月の料金改定（公式）](https://developers.google.com/maps/billing-and-pricing/march-2025)
- 関連: [ディスプレイ/UI ガイド](../guides/03-display-ui.md) / [デバイス API（GPS）](../guides/04-device-apis.md) / [ネットワーク](../guides/06-networking.md)

---

[目次に戻る](../README.md)
