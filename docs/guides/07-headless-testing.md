# ヘッドレステスト(Headless Testing)

> 原文: https://hub.evenrealities.com/docs/guides/headless-testing
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

## いつ使うか

- **提出前検証** — フレームバッファの描画確認、終了ダイアログの確認、コンソールエラーのチェック
- **QA 回帰テスト**の自動化
- **CI のスモークテスト**

## 起動

```bash
evenhub-simulator http://localhost:5173 --automation-port 9898
curl http://127.0.0.1:9898/api/ping   # → pong
```

## テストループの 5 ステップ

1. シミュレーターを起動する
2. `GET /api/console` をポーリングして「app ready」相当のログを待つ(**4 秒以上**かかる想定で)
3. スナップショットを取る(`/api/screenshot/glasses`、`/api/console`)
4. 入力を送る — `POST /api/input` に `{ "action": "click" | "double_click" | "up" | "down" }`
5. 再度スナップショットを取ってアサートする

## 実装のポイント

**Python の場合:**
- JSON / PNG 取得のヘルパー関数を作る
- 描画確認は「**alpha > 0 のピクセルを点灯として数える**」(`lit_pixel_count()`)。100 ピクセル以上で描画ありと判定する等
- タイムアウト付きポーリングにする

**Node の場合:**
- Fetch API ベースで同様に実装
- 簡易チェックなら PNG のバイト長の変化を見る。高精度に検証するなら `sharp` ライブラリ推奨

## ハマりどころ

| 落とし穴 | 対策 |
|---|---|
| ブートログの読み逃し | コンソールバッファをクリアする前に必ず読む |
| ログの二重処理 | `?since_id=N` で増分ポーリングする |
| 緑ピクセルが検出できない | **RGBA を保持する**(RGB に変換すると緑フレームバッファが判定不能になる) |
| 起動直後の入力が無視される | 入力キャプチャコンテナができるまで待ってから `POST /api/input` |
| プロセスの後始末 | `SIGTERM` でクリーンに終了させる |

## 関連ページ

- [シミュレーター](../reference/simulator.md) — Headless Automation API の全エンドポイント仕様

---

[← 前へ: ネットワーキング](06-networking.md) | [次へ: Claude Code プラグイン →](../ai-tooling/claude-code.md)
