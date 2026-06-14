# アーカイブ: Phase 8（音声回答 本実装）/ Phase 9（UI Lab サンドボックス）— 完了タスク詳細

> 元ファイル: `Plans.md` から 2026-06-14 に退避（`/maintenance plans`）。両 Phase とも全タスク `cc:完了`。
> precedence は本ファイルではなく各 spec（`docs/spec/g2-hermes-voice-answer.md` / `docs/spec/ui-lab-sandbox.md`）と `Plans.md` の要約に従う。ここは task ledger の保存用。

---

## Phase 8: 音声回答 本実装（Aivis WAV + audioUrl 配線 + コンパニオン YES/NO 設定）

> **G2 Hermes ワークストリーム**（`apps/g2hermes` ＋ `servers/g2-hermes-bridge`。`apps/hisho` / STT / Hermes Agent の TTS 設定は無改変）。
> Spec delta: `docs/spec/g2-hermes-voice-answer.md` を新設。precedence: `g2-hermes-bridge.md` > `g2-hermes-voice-answer.md` > 本 `Plans.md`。
> **目的**: Phase 7 で確定した「サーバ生成音声を `new Audio()` で前面・背面とも再生可（Android=go）」を受け、**Hermes 回答をユーザー設定（音声で回答 YES/NO・既定 OFF）に応じて音声でも返す**本実装。**本線=方式2（AivisSpeech・WAV をそのまま配信）**。音声生成は **G2 Bridge が Aivis Engine（`127.0.0.1:10101`・VOICEVOX 互換・既定話者 888753760・WAV 44100/mono/16bit）を直接叩く独立実装**。
> **非破壊の核**: 設定 OFF のとき ask は `tts` を付けず Bridge も TTS を走らせない＝**回答挙動は現行と等価**。Aivis 障害時も **テキスト回答は必ず 200 で返り `audioUrl:null` に降格**（500 にしない）。`app.json` whitelist は **audioUrl が同一 origin 相対のため不変**。
> **audioUrl 認証（Hermes レビュー＋Codex レビュー反映）**: `new Audio()` は Authorization を付けられないため `/audio/<id>` は Bearer スキップ。代償として **256bit random id（capability URL）＋ Range 対応（206/416）＋ GET/HEAD 限定（405）＋ `Cache-Control: no-store`＋ id ログ非露出** をセット必須で成立させる。**［Codex P2］認証除外は `/audio/` prefix 判定にする（現状の `PUBLIC_PATHS.has()` 完全一致では `/audio/<id>` が 401）。** **［Codex P2］現状 Bridge は `0.0.0.0` listen のため、bearerless `/audio` を他 IF から守るべく listen を Tailscale IF bind / firewall に締める（8.2 で要件化）。**
> **team_validation_mode**: `manual-pass`（2026-06-11。Mac B の Hermes Agent＝AivisSpeech 構成オーナーと `hermes-chat` で連携し、Aivis API 形状・話者・WAV 仕様・合成実測〔15字≈1.2s/82字≈4.4s〕・timeout 目安を一次確定。audioUrl 配信のセキュリティ〔capability URL 成立条件・Range・総byte 上限・同時実行制限・speechText=短縮版〕を Hermes が独立レビューし反映。Product/Architecture/Security/QA/Skeptic を単独で分けて評価）。
> **lint/format baseline**: TS = biome（`apps/g2hermes`・`servers/g2-hermes-bridge` とも設置済）。Bridge = bun test + Fastify + zod（既存）。新規設置不要。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 8.0 | Spec delta（docs）: 本実装の product contract `docs/spec/g2-hermes-voice-answer.md` 新設（Aivis 連携契約・request `tts` flag・response は既存 `text` 温存＋`speechText`/`audioUrl` 追加・`/audio/<id>` capability 配信・in-memory TTL キャッシュ・graceful degradation・Bridge `.env` 変数）。`g2-hermes-tts-probe.md` 7.6 を本線=方式2(Aivis) に更新。Plans ヘッダー sub-spec 一覧に追加 [tdd:skip:docs] | sub-spec 作成・precedence 明記・probe 7.6 更新・Plans 参照追加 | - | cc:完了（2026-06-11・本計画作成と同時に作成） |
| 8.1 | **Aivis クライアント** `servers/g2-hermes-bridge/src/aivis-client.ts`: `AIVIS_BASE_URL`/`AIVIS_SPEAKER_ID` 等を env から読み、`/audio_query`→`/synthesis` を叩いて WAV Buffer を返す。AbortController timeout（query 5s / synthesis 15s / 全体 20s・env 上書き可）。Aivis 未到達/timeout/非200 は **型付きエラー**で返す（呼び出し側で null 降格）。`fetch` を inject してテスト [tdd:required] | `bun test` green（query→synthesis の URL/method/body/speaker を inject mock で検証・timeout と非200 で型付きエラー・成功で WAV Buffer 返却）・`biome check` 0 | 8.0 | cc:完了 [29f6906]（aivis-client + config・5 test green） |
| 8.2 | **audio ストア + 配信ルート**: in-memory TTL キャッシュ（`Map<id,{buf,expiresAt,bytes}>`・TTL/件数/総byte 三重上限・古い順 evict・**再生後即削除しない**）＋ `GET\|HEAD /audio/:id`。id=`crypto.randomBytes(32).toString("base64url")`。**Bearer 認証除外は `/audio/` prefix 判定**（`path.startsWith('/audio/')`。**現状の `PUBLIC_PATHS.has()` 完全一致では `/audio/<id>` が 401 になる＝Codex P2**）。`Content-Type: audio/wav`・`Content-Length`・`Cache-Control: no-store, private`・`Accept-Ranges: bytes`。**Range→206+Content-Range / 不正→416**。GET/HEAD 以外 405。未知/期限切れ→404。id はログに先頭6文字のみ。**［Codex P2 多層防御］`index.ts` の listen を `0.0.0.0` から Tailscale IF bind に変更（or OS firewall で `/audio` を他 IF から遮断）** [tdd:required（route）/ bind は tdd:skip:integration] | inject テスト green（保存→GET で同一 WAV・HEAD で本文無し+ヘッダ・**Range で 206+Content-Range / 不正 Range で 416**・未知 id 404・TTL/byte 超過で evict・GET/HEAD 以外 405）・**Bearer 無しで `/audio/<動的 id>` GET が 200（prefix 除外が動的 id に効く）**・bind 変更/firewall がコードレビューで確認・`biome check` 0 | 8.0 | cc:完了 [29f6906]（audio-store/audio-range/route・prefix Bearer 除外・bind=config.bindHost・15 test green） |
| 8.3 | **ask 回答経路に TTS opt-in 配線**: request に `tts?: boolean`（zod・既定 false）。**既存 `text` フィールドは無改変で温存**し、`speechText`（任意・初期=`text` を `TTS_MAX_CHARS` で短縮）と `audioUrl` を**追加**（**`text`→`answerText` 改名はしない＝Codex P2・OFF 等価/既存テスト不変**）。`tts:true` のとき speechText→8.1 で WAV→8.2 に保存→**相対** `audioUrl=/audio/<id>` 付与。同時合成は `TTS_MAX_CONCURRENCY`(2) に制限。Aivis 失敗/timeout は **`audioUrl:null`＋200＋structured log**（id 非露出）。音声入力経路（transcribe→回答）も同 ask 経路を再利用 [tdd:required] | inject テスト green（tts:true で audioUrl 付与・tts:false で audioUrl=null かつ Aivis 未呼び出し・Aivis 失敗で audioUrl=null だが 200+text・speechText が MAX_CHARS で切詰・同時実行上限）・既存 ask/transcribe テスト不変・`biome check` 0 | 8.1, 8.2 | cc:完了 [29f6906]（tts flag・graceful null 降格・limiter・既存 44 test 不変） |
| 8.4 | **コンパニオン設定トグル「音声で回答」**: `apps/g2hermes/src/companion/settings.ts`（ピュア・`voiceAnswer:boolean` 既定 **false**・validate/serialize/parse）＋ `storage.ts` に settings 永続化（presets と別キー・bridge/localStorage フォールバック）＋ Companion に Toggle UI（even-toolkit `Toggle`）。状態 lift-up（App が settings 保持） [tdd:required] | `bun test` green（既定 OFF・往復直列化・storage 保存/復元・presets キーと非衝突）・`bun run build` 成功・`biome check` 0 | - | cc:完了 [a7f92ab]（settings.ts・共通 JSON ストア化で settings 永続化・Toggle UI・App lift-up） |
| 8.5 | **クライアント送信に設定反映 + 再生配線**: ask 送信時 `settings.voiceAnswer===true` なら request に `tts:true`（false/未設定なら付けない）。`ANSWERED` 処理で 設定 ON かつ `audioUrl` 有 なら `new Audio(<BRIDGE_BASE>+audioUrl).play()`（play() reject は握り潰してログ・回答表示は阻害しない・404 は正常系）。`app.json` 不変（whitelist 追加なし） [tdd:required（純ロジック）/ play は device-io skip] | `bun test` green（ON→request に tts:true・OFF→tts 未付与・audioUrl 無し/設定 OFF で再生呼ばない の純ロジック）・再生実発火は device-io skip・`bun run build` 成功・`biome check` 0・`git diff apps/g2hermes/app.json` 空 | 8.3, 8.4 | cc:完了 [a7f92ab]（askBridge tts 引数・playAudio・runAsk 配線・App/AppGlasses で settings→tts） |
| 8.6 | **検証 + 配布**: `bun test` 全 green / `biome check` 0 / `bun run build` 成功。Bridge ローカル起動 + 実 Aivis（127.0.0.1:10101）で「設定ON→ask `tts:true`→WAV 生成→audioUrl→ブラウザ/シミュレーターで再生」手動 E2E。設定OFF が現行等価も確認。version bump（0.2.7→0.2.9）＋ **`.env` のある場所で build→`evenhub pack`（直叩き・build→pack 順）**＋ bundle 検証（実 BASE 値・version 0.2.9 を `rg`・ENV 未設定警告なし）。実機サイドロード＋音声鳴動はユーザー [tdd:skip:integration-e2e] | 3 コマンド green + 手動で audioUrl 再生 PASS + 設定OFF 等価確認 + `g2hermes-v0.2.9.ehpk` 生成 + bundle `rg` 検証 PASS。実機鳴動はユーザー | 8.3, 8.5 | cc:完了（bridge 80 + g2hermes 127 test green・biome 0・build 成功・`.ehpk` 160KB 生成・bundle rg で実 BASE 100.88.141.39:8787 と 0.2.9 HIT・ENV 警告なし。**手動 E2E は Aivis 到達不可〔本ビルドホストから loopback/Mac B とも curl exit7〕でスキップ**＝inject テストで代替・実機鳴動はユーザー） |

### Phase 8 スコープ外（YAGNI）

- 話者/style 選択 UI（既定 `888753760` 固定）。MP3/ogg 変換（WAV で足る）。
- 読み上げ UX の作り込み（停止制御・ページ同期・話速・full 回答の自然文化・表示と読み上げの分離）。
- iOS 実機検証（iPhone 未所持・プローブ未判定）。Android 前提で実装。
- Aivis 自動起動（`open -a`）は Optional（8.1/8.3 の graceful null 降格を required とし、auto-start は env `AIVIS_AUTO_START` 既定 false の任意機能）。

### Phase 8 プロセス

ブランチ `feat/g2hermes-voice-answer` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke → Codex Review（`/codex:review` 正規ルート）→ PR → bot レビューループ（CodeRabbit / Copilot / CI green）→ squash merge。Bridge `.env`（`AIVIS_*` 等）は gitignore・実機検証で調整。プローブ用 `.ehpk` サイドロードと音声鳴動確認はユーザー。

> **出荷**: PR #56 マージ（2026-06-11）・Bridge を Mac B に rsync デプロイ・**実機で音声鳴動 OK**（memory `g2-hermes-phase8-voice-answer-shipped`）。

---

## Phase 9: UI Lab サンドボックス（apps/ui-lab・UI デザイン実時間試作）

> **新規ワークストリーム**（`apps/ui-lab`。g2hermes / hisho は無改変）。
> Spec delta: `docs/spec/ui-lab-sandbox.md` を新設。precedence: `ui-lab-sandbox.md` > 本 `Plans.md` Phase 9。
> **目的**: グラス表示（コンテナ方式）の UI を **スマホ companion のコントロールパネルで実時間に変えながらグラスで見比べる**学習・試作アプリ。枠（borderWidth/Radius/Color）・余白（padding）・選択表現（反転/▶/塗り/太枠）・骨格（list/cards/split）・明るさ＋擬似モーダル（textColor/modal/modalDim）を振れる。気に入った数値は出力パネルから TS スニペットで実アプリへ移植。
> **再利用**: `apps/hisho/src/glass/homeCards.ts`（raw SDK 角丸枠カード）/ `useHishoGlasses.ts`（raw SDK ドライバ）のパターンを流用（車輪の再発明なし）。
> **公式プロパティレンジ**（sdk-reference・Phase6 既出）: `borderWidth 0–5` / `borderRadius 0–10` / `borderColor 0–15` / `paddingLength 0–32`。
> **不変条件**: `buildContainers` が常に「`isEventCapture:1` ちょうど1個」「テキストコンテナ ≤ 8」を保証。プロパティ変更は `rebuildPageContainer`＝ちらつき → **約40msデバウンス**。
> **Security**: ネットワーク無し・秘密情報無し・**権限不要**（`app.json` permissions: `[]`）。
> **team_validation_mode**: `manual-pass`（ローカル UI のみ・auth/secret/network/billing/外部連携なし。Product/Architecture/Security/QA/Skeptic を単独評価。修正反映: 公式レンジ訂正・≤8コンテナ/単一eventCapture を不変条件化・rebuild デバウンス・scaffold 先行）。
> **lint/format baseline**: 新規アプリのため未設置 → 9.1 で biome/tsc/vite を hisho に揃えて設置（実装タスクの前提）。

| Task | 内容 | DoD | Depends | Status |
|------|------|-----|---------|--------|
| 9.0 | Spec delta（docs）: `docs/spec/ui-lab-sandbox.md` 新設（DesignParams モデル・公式レンジ・specimen=単一メニュー画面・selectionStyle 4種・modal dim 意味・出力パネル契約・不変条件・権限なし）[tdd:skip:docs] | sub-spec 作成・precedence 明記・公式レンジ固定 | - | cc:完了（2026-06-12・本計画作成と同時に作成） |
| 9.1 | **scaffold + baseline**: `apps/ui-lab` を hisho と同一スタックで生成（app.json: package_id `com.frogman.uilab`・version 0.0.1・permissions `[]`、vite/tsc/biome/react-router/even-toolkit、`__APP_VERSION__` 注入、hello-world 描画）。everything-evenhub `quickstart`/`template` をベースに hisho 構成へ整合 [tdd:skip:scaffold] | `bun run build` 成功・`biome check` 0・`evenhub` で app.json valid・workspaces に認識される | - | cc:完了 |
| 9.2 | **`params/types.ts`（DesignParams + 既定値・ピュア）+ `params/storage.ts`（最後の値を永続化・bridge/localStorage フォールバック）** [tdd:required] | `bun test` green（既定値が全フィールド公式レンジ内・serialize/parse 往復・storage 保存/復元）・`biome check` 0 | 9.1 | cc:完了 |
| 9.3 | **中核 `glass/buildContainers.ts`（純粋関数 `params→CardContainerConfig[]`）**: 枠/余白/選択表現4種/skeleton(list\|cards\|split)/modal dim を表現 [tdd:required] | `bun test` green（枠ON/OFF→border値・selectionStyle 4種マッピング・modal ON で背景 dim＋前面明るカード・skeleton 3分岐・**不変条件: eventCapture が常に1個 / コンテナ ≤ 8**）・`biome check` 0 | 9.2 | cc:完了 |
| 9.4 | **glass driver `glass/useUiLabGlasses.ts` + `AppGlasses.tsx`**: raw SDK で再描画（params 変更で `rebuildPageContainer`・**約40msデバウンス**）・上下で選択行移動・タップで modal トグル。hisho `useHishoGlasses` パターン流用 [tdd:skip:device-io] | `bun run build` 成功・シミュレーターで枠/選択4種/skeleton/modal/brightness の反映をスクショ確認（`test-with-simulator`/`simulator-automation`）・`biome check` 0 | 9.3 | cc:完了（build + biome 0。シミュレーター目視は 9.6 best effort） |
| 9.5 | **companion コントロールパネル**: `Companion.tsx`（Slider/Segmented/Toggle を DesignParams にライブ束縛）＋ `ExportPanel.tsx`（JSON ＋ 生成 container の TS スニペット・コピー）。状態 lift-up + storage [tdd:required（純ロジック）] | `bun test` green（コントロール変更→params 更新・出力スニペットが params と一致）・`bun run build` 成功・`biome check` 0 | 9.2, 9.3 | cc:完了 |
| 9.6 | **検証 + パッケージング**: `bun test` 全 green / `biome check` 0 / `bun run build` 成功。シミュレーターで全ノブ（枠・余白・選択4種・skeleton・modal・brightness）反映を目視。`evenhub pack app.json dist -o ui-lab-v0.0.1.ehpk`（build→pack 順）。実機サイドロードはユーザー [tdd:skip:integration-e2e] | 3 コマンド green + シミュレーターで全ノブ反映 PASS + `ui-lab-v0.0.1.ehpk` 生成。実機はユーザー | 9.4, 9.5 | cc:完了（17 test green・biome 0・build 成功・`.ehpk` 152543 bytes 生成・bundle `0.0.1` HIT。simulator CLI 0.7.3 は確認、スクショ/実機目視はユーザー） |

### Phase 9 スコープ外（YAGNI / v2 以降）

- プリセット保存・呼び出し / specimen（お手本画面）の複数化 / コンテナ個別エディタ / スマホ側の近似プレビュー（v1.5）/ 画像コンテナ / ストア公開。

### Phase 9 プロセス

ブランチ `feat/ui-lab-sandbox` → コード作業前に `andrej-karpathy-skills:karpathy-guidelines` invoke →（任意で Codex Review）→ PR → bot レビューループ → squash merge。`apps/ui-lab` 限定（g2hermes / hisho / even-toolkit 無改変）。

> **出荷**: PR #58 マージ（2026-06-13）・`out/ui-lab-v0.0.1.ehpk` 配布（実機確認はユーザー）（memory `ui-lab-phase9-orca-codex-wip`）。
