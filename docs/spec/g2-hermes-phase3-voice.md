# G2 Hermes Bridge Phase 3: 音声入力 設計ドキュメント

作成日: 2026-06-08

> 位置づけ: 本書は product contract `docs/spec/g2-hermes-bridge.md` の **§13 Phase 3「G2マイク入力」を具体化する設計デルタ**。precedence は `docs/spec/g2-hermes-bridge.md` > 本書 > `Plans.md`。Phase 1（テキスト Bridge）の資産（`/v1/ask`・セッション継続・`paginateForG2`）は**一切改変せず再利用**する。
>
> 検証根拠: even-toolkit v1.7.2 / `@evenrealities/even_hub_sdk` 0.0.10 のソースを 2026-06-08 に読み取り照合（本書 §10）。Mac B の STT 環境はユーザー申告（memory `stt-mac-b-mlx-whisper`）。

---

## 1. 目的とスコープ

キーボードの無い G2 グラスで、**話すだけで Hermes に任意の質問を投げ、回答を表示する**。Phase 1 は「プリセット質問を↕選択」だったが、Phase 3 で**自由入力**を音声で実現する。

**インタラクションモデル: A'（ワンショット + 確定プレビュー）**

```text
タップで録音 → 喋る → 再タップ（or 最大時間）で停止
  → ローカル文字起こし → G2 にテキスト表示で「確認」
    → タップで送信 → Hermes → 回答表示（既存ページング）
```

- リアルタイム途中字幕は**作らない**（BLE 表示が遅く、A' の確認ステップで「伝わったか不安」は解消できるため）。
- STT は **Mac ローカルの mlx-whisper（large-v3-mlx）で batch**。音声を外部クラウドに一切送らない。

## 2. 確定した設計判断（決定ログ）

| # | 決定 | 理由 |
|---|------|------|
| D1 | インタラクション = **A' ワンショット + 確定プレビュー** | 自由入力の目的を満たしつつ、確認ステップで誤認識不安を解消。リアルタイム字幕は BLE 制約で割に合わない |
| D2 | STT = **ローカル mlx-whisper `whisper-large-v3-mlx`（batch）** | Mac B に既設・最高精度クラス・日本語調整済み。**APIキー不要・課金ゼロ・音声を外部に出さない**。リアルタイム不要なのでロード/変換待ちは許容 |
| D3 | 録音トリガー = **タップ開始 / 再タップ終了 ＋ 最大録音時間（30s）保険** | G2 は hold 不可。明示操作が確実。止め忘れ事故を時間上限で防ぐ |
| D4 | STT 実行 = **warm サイドカー常駐**（cold subprocess ではない） | large-v3 はモデルロードが重い。常駐でロード待ちゼロにし体感を保つ。既存 launchd 運用と整合 |
| D5 | 構成 = **2ステップ（`/v1/transcribe` + 既存 `/v1/ask`）** | 文字起こし結果を確認してから送る A' を自然に実現。Phase 1 の `/v1/ask` を無改変で再利用 |
| D6 | 音声取得 = **even-toolkit `GlassBridgeSource` を流用**（provider 層は不使用） | even-toolkit/stt の provider はクラウド固定で差せないが、`GlassBridgeSource` が `audioControl` 順序・PCM16→Float32・WAV 化まで面倒を見る。生 SDK 直叩きより安全 |

## 3. アーキテクチャ / データフロー

```text
G2 mic ──audioControl(true)──▶ apps/g2hermes (WebView, even-toolkit)
   │  GlassBridgeSource → onAudioData コールバックで pcm(Float32Array, 16kHz)
   │  createAudioBuffer(maxSeconds:30) に蓄積
   │  再タップ or 30s → source.stop() → float32ToWav() で WAV Blob
   ▼  POST /v1/transcribe  (audio/wav binary, Bearer)  ※Tailscale=WireGuard 暗号化
servers/g2-hermes-bridge (Mac B)
   │  zod/サイズ検証 → 一時 WAV 保存 → STT サイドカーへ
   ▼  http://127.0.0.1:8643/transcribe (loopback)
STT サイドカー (Python .venv 3.12 / mlx-whisper 常駐, launchd)
   │  whisper-large-v3-mlx（ロード済み）で文字起こし（日本語・幻覚リピート除去）
   ▼  { text, ms }
Bridge ── { text } ──▶ G2（review 画面で確認）
   │
   │  〔ユーザーが確認 → タップ送信〕
   ▼  POST /v1/ask (text)  ← Phase 1 をそのまま再利用（無改変）
Hermes ── answer ──▶ paginateForG2 ──▶ G2 表示（Next/戻る）
```

**プライバシー境界**: 音声は G2 → phone（WebView）→ **Tailscale（WireGuard 暗号化）→ Mac B** までしか流れない。第三者クラウド STT には送らない＝**ユーザー自身の端末内で完結**。Hermes API Key は引き続き Mac B の `.env` のみ。

## 4. コンポーネント設計

### 4.1 STT サイドカー（新規・Mac B 常駐）

- 実体: `~/ai/.venv`（Python 3.12）で動く小さな HTTP サービス（FastAPI もしくは stdlib http）。
- **起動時に mlx-whisper で `mlx-community/whisper-large-v3-mlx` を1回ロードしてメモリ常駐**（D4）。
- 既存 `~/ai/transcribe.py` の**日本語指定（language=ja）と幻覚リピート除去**ロジックを関数として流用。
- I/F:
  - `POST http://127.0.0.1:8643/transcribe` — body: WAV bytes（`audio/wav`）。レスポンス: `{ "text": string, "ms": number }`
  - `GET http://127.0.0.1:8643/health` — `{ "ok": true, "model": "whisper-large-v3-mlx", "loaded": true }`
- **loopback 専用バインド（127.0.0.1）**。Tailscale/LAN には晒さない（Bridge だけが叩く）。
- 常駐: launchd plist `com.frogman.g2hermes-stt`（既存 Bridge/Hermes plist と同形式・`RunAtLoad`/`KeepAlive` true）。配布物は repo に残す（memory `feedback-keep-deploy-artifacts-in-repo`）。

### 4.2 Bridge `POST /v1/transcribe`（新規・既存サーバーに追加）

- 入力: **binary WAV body**（`Content-Type: audio/wav`）。Fastify は `addContentTypeParser('audio/wav', { parseAs: 'buffer' }, ...)` で **raw Buffer** として受ける（`parseAs: 'buffer'` を明示しないと既定で文字列化され WAV が壊れる。multipart 依存も足さない）。
- 認証: 既存と同じ **Bearer**（`BRIDGE_TOKEN`）。
- 検証: Content-Type、**サイズ上限（既定 ~2MB）**。16kHz/16bit mono だと 30s 録音 ≒ 約960KB なので、2MB は D3 の 30s 上限に対する余裕ある安全天井（録音タイマー超過や異常データの保険）。超過は 413。
- 処理: 一時 WAV を保存 → サイドカー `127.0.0.1:8643/transcribe` へ転送 → `{ text, ms }` を返却。一時ファイルは finally で削除。
- **タイムアウト**: `AbortController`。STT 用に長め（既定 60s）。超過は **504** 系（G2 に「文字起こしに失敗」を表示できる形）。
- **CORS**: 既存方針踏襲。**OPTIONS と `/health` は認証スキップ**（Phase 1 で潰した preflight=401 落とし穴を再発させない）。`origin` を Phase 1 同様ログ採取。

### 4.3 `GET /health` 拡張

- 既存（自身 + Hermes 到達性）に **STT サイドカー到達性**を追加。例: `{ ok, hermes: "reachable", stt: "reachable" }`。いずれか不達なら G2 起動時に検知できる。

### 4.4 `apps/g2hermes` 音声キャプチャ（新規・even-toolkit 流用）

- import: `even-toolkit/stt` の `GlassBridgeSource` / `createAudioBuffer` / `float32ToWav`（**provider・useSTT は使わない**。判定D）。
- 取得経路:
  1. `const source = new GlassBridgeSource(); await source.start();`（内部で `window.__evenBridge.rawBridge.audioControl(true)` を await）
  2. `source.onAudioData((pcm, rate) => buffer.append(pcm))` で Float32Array を蓄積。`rate` は even-toolkit の実シグネチャ（`onAudioData(cb: (pcm: Float32Array, sampleRate: number))`＝types.ts:54-59）由来で、glass-bridge では常に 16000（図の「16kHz 固定」と同義）
  3. 停止: `source.stop()`（`audioControl(false)`）+ unsubscribe → `float32ToWav(buffer.getAll(), 16000)` で WAV Blob
  4. `fetch('<bridge>/v1/transcribe', { method:'POST', headers:{Authorization, 'Content-Type':'audio/wav'}, body: wavBlob, signal })` + **AbortController タイムアウト**
- **順序保証**: `GlassBridgeSource.start()` は even-toolkit 側が `createStartUpPageContainer` 完了後の bridge（`window.__evenBridge`）を前提に動く。録音開始（state=recording 遷移時）に呼ぶ。
- **クリーンアップ**: 停止/戻る/終了/`beforeunload` で必ず `source.stop()`（マイク開きっぱなし防止）。
- **最大録音タイマー**: 30s で自動 `stop()`→文字起こしへ（D3）。
- 音声 API 型（SDK 0.0.10 で確認済み）: `audioControl(isOpen: boolean): Promise<boolean>` / `EvenHubEvent.audioEvent?.audioPcm: Uint8Array`。

### 4.5 G2 状態機械（既存の単一画面 + React state を拡張）

```text
idle      … メニュー「🎤 話す」＋ 既存プリセット質問（フォールバックとして併存）
  └ tap →
recording … 「REC ●  タップで停止」。30s で自動停止
  └ tap or timeout →
transcribing … 「文字起こし中…」
  └ 成功 →
review    … 文字起こしテキストを表示。「タップ=送信 / ダブルタップ=録り直し(→recording)」
  └ tap →
thinking  … 「Thinking…」（既存 ask フロー）
  └ 回答 →
answer    … paginateForG2 でページ表示（Next / ダブルタップで戻る）
  ※ error（マイク不可・STT失敗/timeout・Hermes失敗）は各 state から専用表示へ。GO_BACK で idle へ
```

- idle に**プリセット質問を残す**ことで、音声失敗・騒音時の保険になり Phase 1 の体験が劣化しない。
- 既存 `AppGlasses.tsx` の phase（idle/thinking/answer）に **recording/transcribing/review** を追加。`screen.ts` の action ハンドラに録音開始/停止/送信/録り直しを追加。

### 4.6 `app.json` 権限

- **`g2-microphone` permission を追加**（Phase 1 では未付与）。`desc` は提出審査向けに「ローカル文字起こしのためグラスのマイク音声を取得し、ユーザー自身の Mac に送る」旨を明記。
- `network` whitelist は**変更なし**（既存の Mac B Tailscale IP の full origin のまま。LAN IP は使わない）。

## 5. エラー処理・タイムアウト・境界

| 失敗点 | 挙動 |
|--------|------|
| `window.__evenBridge` 不在 / `audioControl` 失敗 | review に進まず「マイクを使えません」表示 → idle |
| 無音・極短録音（空 PCM） | 文字起こし前にクライアントで弾き「もう一度話してください」 |
| `/v1/transcribe` タイムアウト(60s 超) | Bridge 504 → G2「文字起こしに失敗（時間切れ）」→ 録り直し可 |
| サイドカー不達 | `/health` で起動時検知。録音時は 502/504 → 同上 |
| Hermes 失敗/タイムアウト | 既存 `/v1/ask` の挙動を踏襲 |

## 6. セキュリティ / プライバシー境界

- 音声は**第三者クラウドに出ない**（ローカル mlx-whisper のみ）。経路は Tailscale（WireGuard）で暗号化。
- サイドカーは **loopback 専用**。外部から叩けない。
- Bridge Token と Hermes API Key を分離する Phase 1 の境界を維持。`HERMES_API_KEY` は WebView/通信に出さない。
- 一時 WAV は処理後に削除。

## 7. テスト方針

- **サイドカー**: 既知音声 WAV → 期待テキスト（日本語）を返す smoke。`/health` の loaded=true。モデル未ロード時の挙動。
- **Bridge `/v1/transcribe`**: トークン無=401 / 正規=200+`{text}` / OPTIONS preflight=204+CORS / サイズ超過=413 / サイドカー停止時のエラー / タイムアウト=504。inject 統合テスト（Phase 1 同様）＋実 WAV フィクスチャ。
- **クライアント**: PCM バッファ→WAV 化のユニット（無音/最大長/通常）。状態機械の遷移（録音→確認→送信／録り直し）。
- **E2E（実機/シミュレーター）**: 録音→文字起こし表示→送信→Hermes 回答まで。マイク権限の実挙動。
- TDD 対象は**ピュア関数（WAV エンコード境界・状態遷移）とサイドカー/ルート契約**。実機・音声 I/O は手動 E2E（Phase 1 の `[tdd:skip:integration-*]` 方針を踏襲）。

## 8. スコープ外（Phase 3 に含めない）

- リアルタイム途中字幕（streaming STT・WebSocket）
- TTS / 読み上げ（仕様書 §13 Phase 4）
- 常用化: Tunnel 固定ドメイン / HTTPS / JWT / rate limit（§13 Phase 5）
- 音声コマンド（「次へ」等の音声操作）。操作は従来どおりタップ/スワイプ

## 9. 未確認・実装前/実機で確定する点

- [x] even-toolkit/stt の **buffer API の正確な関数名**（`createAudioBuffer` / `append` / `getAll` / `getWav` 等）を確認（**Task 3.3.1・2026-06-09 確定**。実体は §9.1 に記録）。
- [ ] `float32ToWav` の出力 WAV を **mlx-whisper がそのまま読めるか**（16kHz mono PCM WAV）。読めない場合はサイドカー側で soundfile/ffmpeg 経由ロード。
- [ ] サイドカーのモデルロード時間と1発話あたりの**実文字起こしレイテンシ**を実測（Bridge タイムアウト値の根拠に）。
- [ ] 実機 WebView の `audioEvent.audioPcm` が**実際に届くか**（Phase 1 同様、まず origin/イベント実値をログ採取）。シミュレーターは Mac マイク代替。
- [ ] `g2-microphone` permission 付与時の Hub/サイドロードでの**マイク許可フロー**（GPS 権限がサイドロード不可だった件＝memory `reference_hub_dev_mode` の二の舞にならないか要確認）。

### 9.1 even-toolkit/stt export 実体（Task 3.3.1・2026-06-09 確定）

even-toolkit **v1.7.2** の `dist/stt/*.d.ts` を直接読み取り、`package.json` の `exports` マップで `even-toolkit/stt` サブパスが解決することを確認した（`node_modules/.bun/even-toolkit@1.7.2.../dist/stt/index.js`）。3.3.2 の音声キャプチャはこの実シグネチャ前提で実装する。**自前 WAV エンコーダは不要**（`float32ToWav` / `createAudioBuffer().getWav()` が実在）。

| export | 種別 | 正確な signature | 備考 |
|---|---|---|---|
| `GlassBridgeSource` | **class**（`new` で生成） | `new GlassBridgeSource()`（引数なし）／ `start(): Promise<void>` ・ `stop(): void` ・ `onAudioData(cb: (pcm: Float32Array, sampleRate: number) => void): () => void`（戻り値は unsubscribe 関数）・ `dispose(): void` | `AudioSource` を実装。`window.__evenBridge` を自動検出。`start()` 内で `audioControl(true)` を await、`stop()` で `audioControl(false)`。PCM は内部で Uint8Array(16bit LE)→Float32 変換済み。`sampleRate` は glass-bridge では常に **16000** |
| `createAudioBuffer` | **factory 関数** | `createAudioBuffer(config?: { maxSeconds?: number; sampleRate?: number }): { append(chunk: Float32Array): void; getAll(): Float32Array; getWav(): Blob; clear(): void; duration(): number }` | Float32 チャンクを蓄積。`getWav()` は内部 sampleRate で **WAV Blob** を返す |
| `float32ToWav` | 関数 | `float32ToWav(data: Float32Array, sampleRate: number): Blob` | **戻り値は `Blob`**（ArrayBuffer/Uint8Array ではない）。`even-toolkit/stt`（`./audio/pcm-utils`）から re-export |

補助 export（同じ `even-toolkit/stt` から）: `uint8ToPcm16(Uint8Array): Int16Array` / `pcm16ToFloat32(Int16Array): Float32Array` / `float32ToPcm16(Float32Array): Int16Array`。

**実装上の含意（3.3.2 向け）**:
- WAV 出力は **`Blob`**。`fetch` の `body` には Blob を直接渡せるが、`Content-Type: audio/wav` は **明示ヘッダで付与**する（Blob の `type` が空のため）。あるいは `await blob.arrayBuffer()` で `ArrayBuffer` 化して送る。
- spec §4.4 step3 の `float32ToWav(buffer.getAll(), 16000)` と `createAudioBuffer({ sampleRate: 16000 }).getWav()` は等価に使える。`maxSeconds: 30`（D3 の録音上限）は `createAudioBuffer` 側で管理可能。
- 3.0 実機 probe で確定した PCM 形式（16kHz / mono / s16le・100ms チャンク）は `GlassBridgeSource` の出力（Float32 / 16000Hz）と整合。

> 注: `GlassBridgeSource` / index モジュールは import 時に `window` を参照するため Node/bun 直 import は `window is not defined` で落ちる（= **WebView 専用**・解決自体は成功）。サーバー側（Bridge）はこのモジュールに依存しない。

## 10. 参照（読み取り照合の根拠）

- even-toolkit `GlassBridgeSource`: `stt/sources/glass-bridge.ts:16-111`（`start()` で `audioControl(true)`、`onAudioData` で `audioEvent.audioPcm`(Uint8Array,16bit LE)→Float32、`stop()` で `audioControl(false)`、16000Hz）
- `AudioSource` interface: `stt/types.ts:54-59`
- WAV 変換: `stt/audio/pcm-utils.ts:26-54`（`float32ToWav`）/ buffer: `stt/audio/buffer.ts`
- provider がクラウド固定・カスタム登録不可: `stt/registry.ts:4-19` / `stt/providers/whisper-api.ts:12`（OpenAI URL ハードコード）
- SDK 音声 API: `@evenrealities/even_hub_sdk/dist/index.d.ts`（`audioControl(isOpen: boolean): Promise<boolean>` / `AudioEventPayload.audioPcm: Uint8Array` / `EvenHubEvent.audioEvent?`）
- 現アプリ: `apps/g2hermes/src/App.tsx` / `glass/AppGlasses.tsx`（phase 管理）/ `glass/screen.ts`（display+action）/ `api/bridgeClient.ts`（`askBridge`）/ `app.json`
- Mac B STT 環境: memory `stt-mac-b-mlx-whisper`

---

### Notes
- 二正本: product contract = `docs/spec/g2-hermes-bridge.md`（本書は §13 Phase 3 の設計デルタ）、task ledger = `Plans.md`（本書承認後に harness-plan で Phase 3 タスク化）。
- コード作業前に `andrej-karpathy-skills:karpathy-guidelines` を必ず invoke（Phase 1 と同規約）。
