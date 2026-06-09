> **アーカイブ（2026-06-09）**: 本ファイルは G2 Hermes の **Phase 2（コンパニオン カスタム質問）と Phase 3（音声入力）の完了済みタスクの詳細記録**です。ルート `Plans.md` の肥大化を避けるため、各タスクの完了エッセイ（検証メモ・Codex review 結果等）をここへ退避しました。**未完了の tail タスク（2.7 シミュレーター E2E / 3.5.1 実機 E2E）はルート `Plans.md` に残しています**。アーキテクチャ・制約・進行中の Phase はルート `Plans.md` を参照。product contract は `docs/spec/g2-hermes-bridge.md`（+ サブ spec `g2-hermes-companion-custom-questions.md` / `g2-hermes-phase3-voice.md`）。

# G2 Hermes — Phase 2 / Phase 3 完了タスク詳細（アーカイブ）

作成日: 2026-06-09 / アーカイブ日: 2026-06-09

---

## Phase 2: コンパニオン カスタム質問（issue #30）

> Spec delta: `docs/spec/g2-hermes-companion-custom-questions.md`。状態共有 = 素の React lift-up（外部ストア不採用）。team_validation_mode: `subagent`。lint/format = biome。

| Task | 内容 | Status |
|------|------|--------|
| 2.1 | コンパニオン スタイル基盤（hisho 踏襲）: `tailwindcss` + `@tailwindcss/vite` devDeps、`vite.config.ts` プラグイン、`src/app.css`（`@import "tailwindcss"` + toolkit theme/typography/utilities + `@source` 走査 + `@theme` + `#root max-width:430px`）、`main.tsx` で import | cc:完了 [0045cba] |
| 2.2 | `companion/presets.ts` 純粋関数 TDD: `Preset={id,label,text}`、`validatePreset`（label 1〜20字 / text 1〜2000字 / 空拒否）、件数 1〜8、`DEFAULT_PRESETS`、`serialize`/`parse`（不正→default seed フォールバック・共有参照を返さない） | cc:完了 [ceaa7ff] |
| 2.3 | `companion/storage.ts` TDD: `createPresetStore(deps)`（bridge / localStorage 注入可）、`waitForEvenAppBridge` 1500ms タイムアウトで dev フォールバック、書き込み直列化キュー、キー `g2hermes.presets` に JSON 全件上書き、`loadPresets`/`savePresets` | cc:完了 [4582ae8] |
| 2.4 | 状態 lift-up（外部ストア無し）: 会話 `useReducer` + presets を `App.tsx` へ持ち上げ、`AppGlasses` に props 配布。起動時 `loadPresets()`。`useGlasses` 100ms ポーリング無改変 | cc:完了 [430b8ce] |
| 2.5 | A 保存プリセット編集 UI（`even-toolkit/web`・hisho 踏襲）: `companion/editor.ts` 純粋関数 TDD（add/update/remove/move/canPersist）、`PresetEditor.tsx`（`Card`+`ListItem` スワイプ削除 + `Input`/`Textarea`/`Button`）、`Companion.tsx`、write-through 保存。`dirtyRef` で起動時 load が編集中 state を上書きしない、グラスへは valid 部分集合のみ | cc:完了 [2bbfd27] |
| 2.6 | B その場送信 UI + 既存 ask 共有: ask ラウンドトリップを共有 `glass/ask.ts`（`runAsk`）へ抽出、`companion/AskBox.tsx`（`Textarea`+送信、同一 state ミラー）。送信を安全 phase `READY_PHASES=[idle,answer,error]` に限定し音声フロー中の競合を防止 | cc:完了 [342c771] |

**検証サマリ（Phase 2）**: 各タスク `bun test` green（最終 84 pass）/ `biome check` 0 / `bun run --filter g2hermes build` 成功 / `git diff app.json` 空（whitelist・権限不変）。全タスクで Codex review 正規ルート（公式 openai-codex v1.0.4 `--base <ref> --scope branch`）を通し、P2 指摘（起動時 load の編集上書き・idle 空送信・音声フロー競合）はいずれも即修正→再レビュー APPROVE。

**Phase 2 スコープ外（YAGNI）**: 独立ストア / `useSyncExternalStore` / `hermesStore.ts`、アカウント/クラウド同期・複数会話セッション・カテゴリ分け・ドラッグ&ドロップ、グラス側での質問編集、Bridge アドレスのランタイム設定。

---

## Phase 3: 音声入力（G2マイク → ローカル STT → Hermes）

> Spec delta: `docs/spec/g2-hermes-phase3-voice.md`（§13 Phase 3 の具体化）。team_validation_mode: `subagent`。ゲート方針: 3.0（実機マイク到達性）が通るまでサイドカー本実装の重い投資をしない。Phase 1 資産（`/v1/ask`・`paginateForG2`・session）は無改変再利用。

| Task | 内容 | Status |
|------|------|--------|
| 3.0 | 実機マイク到達性スパイク。`app.json` に `g2-microphone`、最小キャプチャ + console ログをサイドロード。シミュレーター不可＝実機のみ | cc:完了（PR #27・v0.1.1） |
| 3.1.0 | Python サイドカー tooling baseline。`servers/g2-hermes-stt`＝uv + hatchling + src レイアウト、ruff + pytest。mlx-whisper は `inference` extra に分離 | cc:完了 |
| 3.1.1 | サイドカー実装: stdlib `http.server`（単一スレッド＝mlx 推論を直列化）+ mlx-whisper `whisper-large-v3-mlx` warm 常駐、`POST /transcribe`（メモリ Buffer 直渡し）→`{text,ms}`、`GET /health`、127.0.0.1 のみ bind、日本語 + 幻覚リピート除去。`text.clean`/`audio.decode_wav`/`transcribe.transcribe_wav` を TDD | cc:完了 |
| 3.1.2 | launchd plist `com.frogman.g2hermes-stt`（RunAtLoad/KeepAlive/ThrottleInterval）+ repo 配置 | cc:完了（PR #31） |
| 3.2.1 | `POST /v1/transcribe`: `addContentTypeParser('audio/wav', {parseAs:'buffer'})` で raw Buffer 受信、Bearer、size 上限→413、`AbortController`→504、サイドカー不達→502、OPTIONS 認証スキップ。`stt-client.ts` 新設、メモリ直渡し | cc:完了 [6280200] |
| 3.2.2 | `GET /health` 拡張: STT 到達性 `stt` フィールド追加。`checkStt`（`checkHermes` と対称）、`Promise.all` で hermes/stt を並行確認・独立判定 | cc:完了（PR #33） |
| 3.3.1 | even-toolkit/stt の export 実体確認（v1.7.2 `dist/stt/*.d.ts`）: `GlassBridgeSource`=class、`createAudioBuffer`=factory（`getWav()`→WAV Blob）、`float32ToWav`→Blob。自前エンコーダ不要と確定 | cc:完了 [2e9baac] |
| 3.3.2 | 音声キャプチャ + WAV化 + POST: pure 関数を `audio/capture.ts`（`concatChunks`/`isTooShort` 500ms 閾値/`encodeWav`）に集約 TDD、WebView 専用 `even/mic-source.ts`（`GlassBridgeSource` ラップ・30s 自動停止・`beforeunload` でマイク閉）、`bridgeClient.transcribe()`（WAV Blob POST・`AbortController` 70s） | cc:完了（PR #32） |
| 3.4.1 | `app.json` に `g2-microphone` 権限追加（desc 文言 = spec §4.6）。network whitelist 不変 | cc:完了（PR #27） |
| 3.4.2 | 状態機械拡張 `idle→recording→transcribing→review→thinking→answer` + `screen.ts` action、idle にプリセット併存、error 表示。`even/lifecycle.ts`（`sysEvent` FOREGROUND_ENTER=4/EXIT=5 監視）で recording 中 background→マイク閉。recording 表示は静的「REC ●」で BLE 過負荷回避。pure reducer を `glass/reducer.ts` に抽出 TDD | cc:完了（PR #32） |

**検証サマリ（Phase 3）**: 各タスク `bun test` green / `ruff check` 0（サイドカー）/ `biome check` 0 / `bun run build` 成功。Code Reviewer / Codex review を通し指摘を反映。

- **3.0 実機確定**: `audioControl(true)` OK、PCM 実形式 = **16kHz / mono / s16le・100ms チャンク（len=3200B/イベント）**（仕様書の「40バイト/フレーム」は誤り）。GPS 型権限ブロックは不発＝マイクは動く。
- **3.1.1/3.1.2 Mac B 実機確定**: warm ~15s→`/health` loaded=true、`lsof`=`127.0.0.1:8643` のみ、**RSS 3.48GB・Hermes(:8642) 同居・swap 0**、実推論 jp.wav→`音声認識のテストです。`(1290ms)、極短 0.1s→空・幻覚なし。`kill -9`→7s 復帰、`kickstart -k`→6s。loopback 実証（Tailscale IP:8643 接続不可）。STT コードは Mac B 未配置だったため rsync + `uv sync --extra inference`（mlx 0.31.2 / mlx-whisper 0.4.3）を ssh 代行配置。
- 流用元 = Mac B `~/VSCodeProjects/creatorzz/transcribe.py` の language=ja + 幻覚除去（`(.{2,12}?)\1{3,}`→畳む）。mlx 環境は計画前提の `~/ai/.venv` ではなく `~/VSCodeProjects/creatorzz/.venv`（py3.12.13）、モデルは `~/ai/models/hub`（HF_HOME=~/ai/models）。

**Phase 3 スコープ外**: リアルタイム途中字幕（streaming STT）/ TTS（§13 Phase 4）/ 常用化: Tunnel・HTTPS・JWT・rate limit（§13 Phase 5）/ 音声コマンド操作。
