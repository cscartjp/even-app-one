# G2 Hermes — 音声回答（Aivis WAV + audioUrl 配線・サブ spec）

> product contract（正本）: `docs/spec/g2-hermes-bridge.md`
> precedence: `g2-hermes-bridge.md` > 各サブ spec > 本 spec > `Plans.md`
> 起票: Phase 7（TTS 実機プローブ）で「サーバ生成音声を `new Audio()` で前面・背面とも再生可（Android = go）」が確定したことを受けた **本実装**の product contract。
> 関連: `docs/spec/g2-hermes-tts-probe.md`（プローブ結論・本実装の本線を方式2=Aivis に更新）。

## 背景・目的

Even G2 にはスピーカーが無く、音声はスマホのスピーカー（Even Hub の Flutter WebView 内 `new Audio()`）から出す。Phase 7 のプローブで **サーバ生成音声を `new Audio()` で再生する方式が Android 前面・背面（画面オフ）とも有効**と実機確認済み（本実装は WAV を配信する）。本 spec は「Hermes の回答テキストをユーザー設定（YES/NO）に応じて音声でも返す」本実装の契約を固定する。

**本線 = 方式2（AivisSpeech・ローカル WAV をそのまま配信）**。プローブ結論時点の想定（方式3=OpenAI TTS）から、Mac B に AivisSpeech を導入したため本線を方式2 へ更新した。音声は **G2 Bridge が AivisSpeech Engine を直接叩いて生成**する（Hermes Agent 自身の TTS 設定 `~/.hermes/config.yaml` とは分離した独立実装）。

## Aivis（AivisSpeech Engine）連携契約（Mac B 実測・2026-06-11）

- Engine: `http://127.0.0.1:10101`（VOICEVOX 互換 API）。Bridge と同一 Mac B 上 → **loopback で叩く**。
- 合成フロー: `POST /audio_query?text=...&speaker=ID`（query JSON 取得・約 0.03s）→ `POST /synthesis?speaker=ID`（body = query JSON）→ **WAV**。
- 既定話者: まお／ノーマル `speaker=888753760`（日本語）。他 style: 888753761〜888753764。
- 出力 WAV: RIFF/PCM・**44100Hz・mono・16bit**。変換なしでそのまま配信（`new Audio()` は WAV 再生可）。
- 合成所要（実測）: 15文字≈1.17s / 53文字≈2.89s / 82文字≈4.43s。時間の大半は `/synthesis`。82文字で WAV 約 1.35MB。
- 起動: AivisSpeech.app 依存（launchd 常駐ではない）。未起動時は `open -a /Applications/AivisSpeech.app` → `/version` 待ちで自動起動可（Bridge 側 Optional 機能）。

## スコープ

**やること（本実装）**:
- クライアント設定「音声で回答」（既定 OFF・コンパニオン側トグル・`storage.ts` 永続化）。
- 設定 ON のときだけ ask リクエストに `tts:true` を付ける（OFF は付けない＝サーバで TTS を走らせない）。
- Bridge: `tts:true` のとき回答の **speechText（短縮済み）** から Aivis で WAV 生成 → in-memory TTL キャッシュ格納 → response に **同一 origin 相対の `audioUrl`（`/audio/<id>`）** を添付。
- Bridge: `GET /audio/<id>`（capability URL・Bearer スキップ・Range 対応）で WAV 配信。
- クライアント: `ANSWERED` で 設定 ON かつ `audioUrl` 有 なら `new Audio(<base>+audioUrl).play()`。

**やらないこと（YAGNI・本 spec 外）**:
- 話者/style 選択 UI（既定 `888753760` 固定）。
- MP3/ogg 変換（WAV で足る・Tailscale ローカル帯域で許容）。
- 読み上げ UX の作り込み（停止制御・ページ同期・話速・full 回答の自然文化）。
- iOS 実機検証（iPhone 未所持・プローブ未判定のまま）。Android を前提に実装する。
- Hermes Agent 自身の TTS 設定（`~/.hermes/config.yaml`）の変更（分離・無改変）。

## 設計契約

### データ契約（`g2-hermes-bridge.md` 既存 schema への delta）
- **request**: ask（および音声入力経路の回答生成）に `tts?: boolean`（zod・**既定 false**）を追加。
- **response**: 既存 `audioUrl: string | null`（schema に既存スロット有）を**実値で使う**。`tts:true` かつ合成成功時のみ `/audio/<id>`（**相対 URL**）、それ以外は `null`。
- **読み上げ対象 = `speechText`（既存 `text` は無改変で温存）**: 既存の表示用回答フィールド **`text`**（`server.ts` の ask/transcribe スキーマで使用中）は名称・意味を変えず維持し、読み上げ用に **`speechText`（任意）** を**追加**する。**`text`→`answerText` への改名はしない**（OFF 経路バイト等価と既存 ask/transcribe テストを壊さないため）。**初期は `speechText` = `text` をグラス用に短縮したもの**（表示と読み上げのズレを避ける）。将来「表示は箇条書き／読み上げは自然文」に分離可能。
- **TTS 対象文字数上限**: 200〜300字程度（超過は切り詰め or audioUrl:null）。長文読み上げ（full 回答）は WAV 肥大・体験劣化のため避ける。

### `/audio/<id>` 配信（capability URL）
`new Audio(url)` は `Authorization` ヘッダを付けられないため Bearer 認証をスキップする。その代償として以下を**セットで必須**にすることで capability URL として成立させる:
- **id 強度**: 256bit random（`crypto.randomBytes(32).toString("base64url")`）。推測不能。
- **Bearer スキップ（prefix 判定が必須）**: preHandler の認証除外を **`/audio/` prefix**（`path.startsWith('/audio/')`）または route 単位 bypass にする。**現状の `PUBLIC_PATHS.has(path)` 完全一致では `/audio/<id>` が 401 になる**ため、`/audio` を set に足すだけでは不十分。`/audio/<動的 id>` の bearerless GET/HEAD が 200 を返すテストを必須にする。
- **method 制限**: GET / HEAD のみ。他は 405。
- **ヘッダ**: `Content-Type: audio/wav`・`Content-Length` 必須・`Cache-Control: no-store, private`・`Accept-Ranges: bytes`。`Content-Disposition` は付けるなら `inline`。
- **Range 対応（実機再生安定化の要）**: `Range: bytes=...` 有 → `206 Partial Content` + `Content-Range`、不正 Range → `416`。HTMLAudioElement が Range を複数回投げるため **再生後即削除しない**（TTL/LRU のみで退避）。
- **ログ非露出**: access/error/client log に id 全体を出さない（出すなら先頭 6 文字）。
- **未知/期限切れ id → 404**（クライアントは 404 を正常系として握り潰す）。
- **CORS**: 単純 `new Audio()` 再生は不要（Web Audio で波形を読まない限り）。audioUrl は **同一 origin 相対**（絶対 URL 生成時の Host header injection を避ける）→ `app.json` whitelist は既存テキスト API と共通で**不変**。

### in-memory TTL キャッシュ
- 構造: `Map<id, {buf: Buffer, expiresAt: number, bytes: number}>`。ディスクに残さない。
- 退避: **TTL（既定 300s）＋ 件数上限（既定 100）＋ 総 byte 上限（既定 200MB）** の三重。超過は古い順（LRU/oldest-first）evict。
- 同時実行: Aivis `/synthesis` の並列叩きは重いため **同時 1〜2 本に制限**（軽量キュー）。

### Bridge 障害時の挙動（graceful degradation）
- Aivis 未到達 / `/synthesis` timeout / 合成失敗 → **`audioUrl: null` でテキスト回答は必ず 200 で返す**（500 にしない）。structured log に記録。
- timeout（実測ベース・env 上書き可）: `/audio_query` 5s / `/synthesis` 15s / 全体 abort 20s。
- Optional 自動起動: Aivis 未到達時 `open -a AivisSpeech.app` を1回試行→`/version` 待ち（最大待ち時間を明示）。初回コールドスタートは `audioUrl:null` 許容でもよい。
- 軽い濫用対策: TTS 対象文字数制限＋（任意）簡易 rate limit。

### Bridge 環境変数（`servers/g2-hermes-bridge/.env`・server 側のみ。client bundle と無関係）
| 変数 | 既定 | 必須 |
|------|------|------|
| `AIVIS_BASE_URL` | `http://127.0.0.1:10101` | ○ |
| `AIVIS_SPEAKER_ID` | `888753760` | ○ |
| `AIVIS_QUERY_TIMEOUT_MS` | `5000` | - |
| `AIVIS_SYNTHESIS_TIMEOUT_MS` | `15000` | - |
| `AIVIS_ABORT_TIMEOUT_MS` | `20000` | - |
| `AIVIS_AUTO_START` | `false` | - |
| `AIVIS_APP_PATH` | `/Applications/AivisSpeech.app` | - |
| `TTS_MAX_CHARS` | `300` | - |
| `TTS_MAX_CONCURRENCY` | `2` | - |
| `AUDIO_TTL_SECONDS` | `300` | - |
| `AUDIO_MAX_ENTRIES` | `100` | - |
| `AUDIO_MAX_BYTES` | `209715200` | - |

### セキュリティ境界
- 新たな秘密情報なし。`HERMES_API_KEY` は無関係。Aivis は loopback（外部 egress なし）。
- 読み上げ対象は既にグラスへ送る回答テキスト → 新たなデータ境界を作らない。
- `/audio/<id>` の **一次防御 = 256bit capability id（推測不能）＋ `no-store` ＋ id ログ非露出 ＋ 他経路は Bearer 必須**（Bearer スキップの代替）。
- **bind の現実と要件**: 現状 Bridge は `index.ts` で **`0.0.0.0` listen**（スマホが Tailscale IP で到達するため）。bearerless の `/audio` が LAN 等の他インターフェースから到達しないよう、**Bridge listen を Tailscale インターフェース IP への bind（または OS firewall での制限）に変更することを本実装の必須要件**とする。256bit id があるため漏洩リスクは低いが、多層防御として bind を締める（Phase 8 task で要件化）。

## 完了の定義（本実装として）

- コンパニオン設定 ON 時にのみ Bridge へ `tts:true` が渡り、Bridge が Aivis WAV を生成して相対 `audioUrl` を返し、クライアントが `ANSWERED` で再生する E2E が実 Aivis（127.0.0.1:10101）で通る。
- 設定 OFF は TTS を一切走らせず、回答挙動が現行と等価。
- Aivis 障害時もテキスト回答は 200 で返り、`audioUrl:null` に降格する。
- `/audio/<id>` が Range（206/416）・GET/HEAD のみ（405）・未知 id 404 を満たす。
- `bun test` 全 green・`biome check` 0・`bun run build` 成功。`app.json` 不変（whitelist 追加なし）。

## レビュー来歴

- 2026-06-11: Mac B の Hermes Agent（AivisSpeech 構成オーナー）と `hermes-chat` 経由で連携し、Aivis API 形状・話者・WAV 仕様・合成実測・timeout 目安を確定。audioUrl 配信は Hermes レビューで **Range 対応 / 256bit id / no-store / ログ非露出 / 総byte 上限 / 同時実行制限 / speechText=短縮版** を追加（capability URL を Bearer スキップで成立させる条件）。
