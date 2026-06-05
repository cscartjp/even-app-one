# スキルカタログ(Skill Catalog)

> 原文: https://hub.evenrealities.com/docs/AI-tooling/claude%20code/skill-catalog
> ※ 本ページは公式ドキュメントの非公式な日本語要約です。

everything-evenhub プラグインに含まれる Claude Code スキルの一覧。スキル定義は [even-realities/everything-evenhub](https://github.com/even-realities/everything-evenhub) リポジトリの `skills/` ディレクトリにある。

## Tier 1 — ワンクリックスキル

| スキル | 目的 | 使用例 |
|---|---|---|
| `quickstart` | 空の Even G2 アプリをゼロから構築(Vite + TypeScript + SDK) | `/quickstart my-weather-app` |
| `template` | `evenhub-templates` のスターター(minimal / asr / image / text-heavy)から雛形生成 | `/template my-reader --text-heavy` |
| `build-and-deploy` | `.ehpk` をビルドして Even Hub に公開 | `/build-and-deploy` |

## Tier 2 — コア開発スキル

| スキル | 目的 | 使用例 |
|---|---|---|
| `glasses-ui` | グラス向けディスプレイ UI 構築(コンテナ・テキスト・画像・リスト) | `/glasses-ui "show a 3-item menu with a title bar"` |
| `handle-input` | タッチパッド・リング入力・ライフサイクルイベントの配線 | `/handle-input "single press cycles screens, double press exits"` |
| `device-features` | オーディオキャプチャ・IMU・デバイス情報・ストレージの活用 | `/device-features "toggle microphone recording on click"` |
| `background-state` | バックグラウンド復帰時の状態保持(`setBackgroundState` + `onBackgroundRestore`) | `/background-state src/main.ts` |
| `test-with-simulator` | シミュレーターでの実行・デバッグ | `/test-with-simulator "debug my app with glow effect"` |
| `simulator-automation` | シミュレーターの HTTP API 駆動(スクリーンショット・入力注入・ログ) | `/simulator-automation "take a screenshot and verify text is displayed"` |
| `font-measurement` | LVGL ファームウェア描画に合わせたピクセル精度のテキスト測定 | `/font-measurement "size a text container for a long paragraph with 8px padding"` |

## Tier 3 — リファレンススキル

| スキル | 目的 | 使用例 |
|---|---|---|
| `sdk-reference` | SDK の API・型・パターンを検索 | `/sdk-reference createStartUpPageContainer` |
| `cli-reference` | CLI コマンド・フラグを検索 | `/cli-reference evenhub qr` |
| `design-guidelines` | ディスプレイ設計制約と UX ベストプラクティス | `/design-guidelines settings screen with 5 options` |

## テストハーネス

プラグインのリポジトリには、AI エージェントでスキルの回帰テストを行う「ハーネス」ランナーが含まれている:

```
/harness quickstart
```

新しいスキルのテスト追加方法はソースリポジトリの `harness/README.md` を参照。

---

[← 前へ: Claude Code プラグイン](claude-code.md) | [次へ: シミュレーター →](../reference/simulator.md)
