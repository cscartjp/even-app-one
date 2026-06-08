# Even G2 × Hermes Agent ブリッジアプリ仕様・実装ドキュメント

作成日: 2026-06-08  
対象: Even Hub SDKで作成済みのEven G2アプリから、Mac上のHermes Agentへ音声/テキストで会話するためのブリッジ構成

---

## 1. 結論

Even G2単体でHermes Agentを直接動かすのではなく、**Even Hub plugin → Mac側Bridge Server → Hermes Agent API Server/CLI → TTS/STT → Even G2表示**という分離構成にするのが現実的。

推奨構成は以下。

```text
Even G2 glasses
  ↑↓ Bluetooth
Even Realities App on phone WebView
  ↑↓ HTTPS or local HTTP/WebSocket
Mac Bridge Server, Node.js/TypeScript
  ├─ Hermes Agent API Server: http://127.0.0.1:8642/v1/responses
  ├─ STT: Whisper/OpenAI/Groq/local faster-whisper等
  └─ TTS: Hermes TTS, macOS say, Edge/OpenAI TTS等
```

重要ポイント:

- Even Hubアプリは**スマホ内WebViewで動くWebアプリ**。
- G2本体は表示と入力イベントを扱い、アプリロジックはスマホ側WebViewで動く。
- G2は**スピーカーなし**。音声返答はMac/スマホ側再生、またはG2上のテキスト表示になる。
- API接続はEven Hub側の`app.json` network whitelistと、通常のブラウザCORSの両方を通す必要がある。
- Hermes Agentには、Mac上でHermes API Serverを起動し、Bridge ServerからOpenAI互換APIとして叩くのが一番扱いやすい。

---

## 2. 参考にした一次情報

- Even Hub Overview  
  https://hub.evenrealities.com/docs/getting-started/overview
- Even Hub Architecture  
  https://hub.evenrealities.com/docs/getting-started/architecture
- Even Hub Networking  
  https://hub.evenrealities.com/docs/guides/networking
- Even Hub Packaging  
  https://hub.evenrealities.com/docs/reference/packaging
- npm: `@evenrealities/even_hub_sdk@0.0.10`
- Hermes Agent API Server  
  https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server
- community notes: `nickustinov/even-g2-notes`  
  https://github.com/nickustinov/even-g2-notes
- community toolkit: `even-toolkit`  
  https://github.com/fabioglimb/even-toolkit

---

## 3. Even Hub側の制約整理

### 3.1 実行モデル

Even Hub pluginは通常のWebアプリ。

```text
Even Hub Cloud
  ↓
Phone / Even Realities App / WebView
  ↓ Bluetooth
Even G2 glasses
```

- WebView: AndroidはChromium、iOSはWKWebView。
- SDKはWebView内に`EvenAppBridge`を提供する。
- Web → glassesは`bridge.callEvenApp(...)`経由。
- glasses → Webは`window._listenEvenAppMessage(...)`経由でSDKイベント化される。

### 3.2 G2ハードウェア

公式ドキュメント上の主要仕様:

- display: 576 × 288 px per eye
- color depth: 4-bit greyscale / green 16階調
- audio input: 4-mic array, 16kHz PCM stream
- input: press, double press, swipe up/down
- camera: なし
- speaker: なし

### 3.3 SDK主要API

`@evenrealities/even_hub_sdk@0.0.10`で確認した主要API。

```ts
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

const bridge = await waitForEvenAppBridge();
```

主に使うもの:

- `bridge.createStartUpPageContainer(...)`
  - 最初に1回だけ呼ぶ。
  - これを呼んでからUI更新、マイク、IMU操作を行う。
- `bridge.rebuildPageContainer(...)`
  - 2回目以降のページ再構築。
- `bridge.textContainerUpgrade(...)`
  - テキスト表示更新。返答・ステータス表示に使う。
- `bridge.audioControl(true | false)`
  - G2マイクのON/OFF。
  - 成功後、`onEvenHubEvent`で`audioEvent.audioPcm`が届く。
- `bridge.onEvenHubEvent(callback)`
  - list/text/sys/audioイベントを受ける。
- `bridge.onLaunchSource(callback)`
  - `appMenu` / `glassesMenu`起動元を受ける。
- `bridge.shutDownPageContainer(0 | 1)`
  - 終了。

### 3.4 UIコンテナ制限

SDK README上の制約:

- `containerTotalNum`: 1〜12
- `textObject`: 最大8
- `imageObject`: 最大4相当
- `textContainer.content`: 起動時最大1000文字
- `textContainerUpgrade.content`: 最大2000文字
- `containerName`: 最大16文字
- `isEventCapture=1`はページ内で1コンテナのみ

Hermes応答をそのまま全量表示すると長すぎるため、Bridge Server側で以下のように整形する。

- 1画面: 80〜160字程度
- 長文: ページング/要約/スクロール制御
- G2表示: 「状態」「短い回答」「続きを見る」中心

---

## 4. ブリッジアプリの役割分担

### 4.1 Even Hub plugin側

責務:

- G2 UIの初期化
- マイクON/OFF
- PCM音声またはテキスト入力をBridge Serverへ送信
- Bridge Serverから返った返答をG2に表示
- 操作イベントで録音開始/停止、キャンセル、再送、ページ送りを制御

やらない方がよいこと:

- Hermes Agentへ直接接続
- APIキー保持
- 重いSTT/TTS処理
- 複雑な会話状態管理

理由:

- WebView内に秘密情報を置きたくない。
- CORS/whitelist/HTTPS制約がある。
- 音声処理・Hermes Agent呼び出しはMac側の方が安定する。

### 4.2 Mac Bridge Server側

責務:

- Even Hub plugin用HTTP/WebSocket APIを提供
- CORS対応
- 認証トークン検証
- 音声PCMのバッファリング
- STT実行
- Hermes Agent API Serverへ問い合わせ
- 応答の短文化・ページング
- 必要ならTTS生成/再生
- セッション管理

### 4.3 Hermes Agent側

推奨はAPI Server。

```bash
# ~/.hermes/.env
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
# ブラウザから直接叩く場合のみ。通常はBridge Serverだけが叩くので不要。
# API_SERVER_CORS_ORIGINS=http://localhost:5173
```

起動:

```bash
hermes gateway
```

期待される起動ログ:

```text
[API Server] API server listening on http://127.0.0.1:8642
```

Bridge Serverからは以下を使う。

- 単発/軽量: `POST /v1/chat/completions`
- 会話継続: `POST /v1/responses` + `previous_response_id`

この用途では**会話継続しやすい`/v1/responses`推奨**。

---

## 5. 推奨API仕様

### 5.1 Transport選定

最短実装:

- `fetch()`でHTTP POST
- STT済みテキストを送る
- 返答JSONを受ける

音声ストリーミングをしたい場合:

- WebSocket推奨
- PCM chunkを逐次送る
- `end_audio`後にSTT→Hermes→返答

最初はHTTPで十分。音声PCMを扱うならWebSocketへ進める。

### 5.2 Bridge Server REST API案

#### `GET /health`

Bridge Server確認。

Response:

```json
{
  "ok": true,
  "version": "0.1.0",
  "hermes": "reachable"
}
```

#### `POST /v1/ask`

テキスト入力をHermesへ送る。

Request:

```json
{
  "sessionId": "g2-main",
  "text": "今日の予定を短く教えて",
  "mode": "short",
  "voice": false
}
```

Response:

```json
{
  "ok": true,
  "sessionId": "g2-main",
  "responseId": "resp_xxx",
  "text": "今日は13時から打ち合わせがあります。詳細を表示しますか？",
  "pages": [
    "今日は13時から打ち合わせがあります。",
    "詳細を表示しますか？"
  ],
  "audioUrl": null
}
```

#### `POST /v1/audio/start`

録音セッション開始。

Request:

```json
{
  "sessionId": "g2-main",
  "sampleRate": 16000,
  "encoding": "pcm_s16le"
}
```

Response:

```json
{
  "ok": true,
  "audioSessionId": "aud_..."
}
```

#### `POST /v1/audio/chunk`

PCM chunk送信。HTTPでやる場合の簡易案。

Request:

```json
{
  "audioSessionId": "aud_...",
  "seq": 1,
  "pcmBase64": "..."
}
```

Response:

```json
{ "ok": true }
```

#### `POST /v1/audio/finish`

録音終了 → STT → Hermes → 整形返答。

Request:

```json
{
  "audioSessionId": "aud_...",
  "sessionId": "g2-main"
}
```

Response:

```json
{
  "ok": true,
  "transcript": "Hermesに聞こえますか？",
  "text": "はい、聞こえています。何をしますか？",
  "pages": ["はい、聞こえています。", "何をしますか？"],
  "audioUrl": null
}
```

### 5.3 WebSocket API案

URL:

```text
wss://bridge.example.com/v1/ws?sessionId=g2-main&token=...
```

Client → Server:

```json
{ "type": "start_audio", "sampleRate": 16000, "encoding": "pcm_s16le" }
```

```json
{ "type": "audio_chunk", "seq": 1, "pcmBase64": "..." }
```

```json
{ "type": "end_audio" }
```

```json
{ "type": "ask", "text": "短く答えて" }
```

Server → Client:

```json
{ "type": "status", "message": "listening" }
```

```json
{ "type": "transcript", "text": "明日の予定は？" }
```

```json
{ "type": "answer", "text": "明日は10時から会議です。", "pages": ["明日は10時から会議です。"] }
```

```json
{ "type": "error", "code": "stt_failed", "message": "音声認識に失敗しました" }
```

---

## 6. app.json例

ローカル開発用。スマホとMacが同一LAN上にあり、MacのIPが`192.168.1.20`の場合。

```json
{
  "package_id": "com.yoshi.g2hermes",
  "edition": "202601",
  "name": "G2 Hermes",
  "version": "0.1.0",
  "min_app_version": "2.0.0",
  "min_sdk_version": "0.0.10",
  "entrypoint": "index.html",
  "permissions": [
    {
      "name": "network",
      "desc": "Connects to the local bridge server for Hermes Agent conversation.",
      "whitelist": ["http://192.168.1.20:8787"]
    },
    {
      "name": "g2-microphone",
      "desc": "Uses the G2 microphone for voice commands."
    }
  ],
  "supported_languages": ["ja", "en"]
}
```

本番/常用ならHTTPSにする。

```json
"whitelist": ["https://g2-bridge.example.com"]
```

注意:

- whitelistはCORS回避ではない。
- Bridge Server側も`Access-Control-Allow-Origin`等が必要。
- productionではHTTPS必須。
- wildcardやbare hostnameは不可。
- whitelistはorigin単位で書く。

---

## 7. Even Hub plugin実装サンプル

### 7.1 テキスト中心の最小実装

```ts
import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ListContainerProperty,
} from '@evenrealities/even_hub_sdk';

const BRIDGE_BASE = import.meta.env.VITE_BRIDGE_BASE ?? 'http://192.168.1.20:8787';
const TOKEN = import.meta.env.VITE_BRIDGE_TOKEN ?? 'dev-token';

const sessionId = 'g2-main';
let currentPages: string[] = [];
let currentPageIndex = 0;

async function initG2() {
  const bridge = await waitForEvenAppBridge();

  const list: ListContainerProperty = {
    xPosition: 24,
    yPosition: 24,
    width: 528,
    height: 80,
    containerID: 1,
    containerName: 'menu',
    itemContainer: {
      itemCount: 3,
      itemName: ['Ask', 'Next', 'Exit'],
      isItemSelectBorderEn: 1,
    },
    isEventCapture: 1,
  };

  const text: TextContainerProperty = {
    xPosition: 24,
    yPosition: 120,
    width: 528,
    height: 140,
    containerID: 2,
    containerName: 'answer',
    content: 'Hermes ready',
    isEventCapture: 0,
  };

  const result = await bridge.createStartUpPageContainer({
    containerTotalNum: 2,
    listObject: [list],
    textObject: [text],
  });

  if (result !== 0) {
    console.error('createStartUpPageContainer failed:', result);
    return;
  }

  bridge.onEvenHubEvent(async (event) => {
    const selected = event.listEvent?.currentSelectItemName;
    if (!selected) return;

    if (selected === 'Ask') {
      await askHermes(bridge, '短く自己紹介して');
    }

    if (selected === 'Next') {
      await showNextPage(bridge);
    }

    if (selected === 'Exit') {
      await bridge.shutDownPageContainer(0);
    }
  });
}

async function askHermes(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>, text: string) {
  await setText(bridge, 'Thinking...');

  const res = await fetch(`${BRIDGE_BASE}/v1/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ sessionId, text, mode: 'short' }),
  });

  if (!res.ok) {
    await setText(bridge, `Bridge error: ${res.status}`);
    return;
  }

  const data = await res.json();
  currentPages = data.pages?.length ? data.pages : [data.text ?? 'No response'];
  currentPageIndex = 0;
  await setText(bridge, currentPages[0]);
}

async function showNextPage(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {
  if (!currentPages.length) return;
  currentPageIndex = (currentPageIndex + 1) % currentPages.length;
  await setText(bridge, currentPages[currentPageIndex]);
}

async function setText(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>, content: string) {
  await bridge.textContainerUpgrade({
    containerID: 2,
    containerName: 'answer',
    contentOffset: 0,
    contentLength: content.length,
    content: content.slice(0, 1800),
  });
}

initG2().catch(console.error);
```

### 7.2 G2マイクを使う場合のイベント処理イメージ

SDK上は`audioControl(true)`後、`event.audioEvent.audioPcm`に`Uint8Array`が届く。

```ts
let recording = false;
let audioSessionId: string | null = null;
let seq = 0;

async function startRecording(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {
  const res = await fetch(`${BRIDGE_BASE}/v1/audio/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, sampleRate: 16000, encoding: 'pcm_s16le' }),
  });
  const data = await res.json();
  audioSessionId = data.audioSessionId;
  seq = 0;
  recording = true;
  await bridge.audioControl(true);
  await setText(bridge, 'Listening...');
}

async function finishRecording(bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>>) {
  recording = false;
  await bridge.audioControl(false);
  await setText(bridge, 'Transcribing...');

  const res = await fetch(`${BRIDGE_BASE}/v1/audio/finish`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ sessionId, audioSessionId }),
  });
  const data = await res.json();
  currentPages = data.pages ?? [data.text];
  currentPageIndex = 0;
  await setText(bridge, currentPages[0] ?? 'No response');
}

function onEvenHubEvent(event: any) {
  const pcm = event.audioEvent?.audioPcm as Uint8Array | undefined;
  if (!recording || !audioSessionId || !pcm) return;

  const pcmBase64 = uint8ToBase64(pcm);
  fetch(`${BRIDGE_BASE}/v1/audio/chunk`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ audioSessionId, seq: ++seq, pcmBase64 }),
  }).catch(console.error);
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`,
  };
}

function uint8ToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
```

注意:

- PCMの実フォーマットは実機でログを取り確認する。
- 公式Overviewでは16kHz PCM streamとされる。
- chunkをHTTPで連打すると遅延や欠落の原因になるため、実運用はWebSocket推奨。
- Hermes応答生成中は`audioControl(false)`でマイクを閉じる方が扱いやすい。

---

## 8. Mac Bridge Server実装サンプル

Node.js + TypeScript + Fastify例。

### 8.1 package

```bash
mkdir g2-hermes-bridge
cd g2-hermes-bridge
npm init -y
npm i fastify @fastify/cors zod
npm i -D typescript tsx @types/node
```

### 8.2 `.env`例

```bash
PORT=8787
BRIDGE_TOKEN=dev-token
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_API_KEY=change-me-local-dev
```

### 8.3 server.ts

```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';

const app = Fastify({ logger: true });

const PORT = Number(process.env.PORT ?? 8787);
const BRIDGE_TOKEN = process.env.BRIDGE_TOKEN ?? 'dev-token';
const HERMES_BASE_URL = process.env.HERMES_BASE_URL ?? 'http://127.0.0.1:8642/v1';
const HERMES_API_KEY = process.env.HERMES_API_KEY ?? 'change-me-local-dev';

await app.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const sessions = new Map<string, { previousResponseId?: string }>();
const audioBuffers = new Map<string, Buffer[]>();

app.addHook('preHandler', async (req, reply) => {
  if (req.url === '/health') return;
  const auth = req.headers.authorization ?? '';
  if (auth !== `Bearer ${BRIDGE_TOKEN}`) {
    return reply.code(401).send({ ok: false, error: 'unauthorized' });
  }
});

app.get('/health', async () => {
  const hermes = await checkHermes();
  return { ok: true, version: '0.1.0', hermes };
});

const AskSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  mode: z.enum(['short', 'normal']).default('short'),
});

app.post('/v1/ask', async (req, reply) => {
  const body = AskSchema.parse(req.body);
  const answer = await askHermes(body.sessionId, body.text, body.mode);
  return reply.send(answer);
});

const AudioStartSchema = z.object({
  sessionId: z.string(),
  sampleRate: z.number().default(16000),
  encoding: z.string().default('pcm_s16le'),
});

app.post('/v1/audio/start', async (req, reply) => {
  AudioStartSchema.parse(req.body);
  const audioSessionId = `aud_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  audioBuffers.set(audioSessionId, []);
  return reply.send({ ok: true, audioSessionId });
});

const AudioChunkSchema = z.object({
  audioSessionId: z.string(),
  seq: z.number(),
  pcmBase64: z.string(),
});

app.post('/v1/audio/chunk', async (req, reply) => {
  const body = AudioChunkSchema.parse(req.body);
  const buffers = audioBuffers.get(body.audioSessionId);
  if (!buffers) return reply.code(404).send({ ok: false, error: 'audio_session_not_found' });
  buffers.push(Buffer.from(body.pcmBase64, 'base64'));
  return reply.send({ ok: true });
});

const AudioFinishSchema = z.object({
  sessionId: z.string(),
  audioSessionId: z.string(),
});

app.post('/v1/audio/finish', async (req, reply) => {
  const body = AudioFinishSchema.parse(req.body);
  const buffers = audioBuffers.get(body.audioSessionId);
  if (!buffers) return reply.code(404).send({ ok: false, error: 'audio_session_not_found' });

  audioBuffers.delete(body.audioSessionId);
  const pcm = Buffer.concat(buffers);

  // TODO: 実装時にSTTへ差し替える。
  // 例: pcm_s16le -> wav化 -> whisper/faster-whisper/OpenAI Whisperへ送る。
  const transcript = await transcribePcmPlaceholder(pcm);
  const answer = await askHermes(body.sessionId, transcript, 'short');

  return reply.send({ ...answer, transcript });
});

async function askHermes(sessionId: string, text: string, mode: 'short' | 'normal') {
  const state = sessions.get(sessionId) ?? {};
  const input = mode === 'short'
    ? `G2スマートグラスに表示するため、80字以内を基本に短く日本語で答えて。必要なら箇条書き最大3つ。\n\nUser: ${text}`
    : text;

  const payload: Record<string, unknown> = {
    model: 'hermes-agent',
    input,
    store: true,
  };
  if (state.previousResponseId) payload.previous_response_id = state.previousResponseId;

  const res = await fetch(`${HERMES_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERMES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Hermes API error ${res.status}: ${detail}`);
  }

  const json: any = await res.json();
  const answerText = extractOutputText(json) || '返答を取得できませんでした';
  sessions.set(sessionId, { previousResponseId: json.id });

  return {
    ok: true,
    sessionId,
    responseId: json.id,
    text: answerText,
    pages: paginateForG2(answerText),
    audioUrl: null,
  };
}

function extractOutputText(response: any): string {
  // OpenAI Responses API形式のoutputからmessage/output_textを抽出
  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c.type === 'output_text' && c.text) chunks.push(c.text);
    }
  }
  return chunks.join('\n').trim();
}

function paginateForG2(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const pages: string[] = [];
  const max = 90;
  for (let i = 0; i < cleaned.length; i += max) pages.push(cleaned.slice(i, i + max));
  return pages.length ? pages : [''];
}

async function transcribePcmPlaceholder(_pcm: Buffer): Promise<string> {
  return '音声認識は未実装です。テキスト入力でテストしてください。';
}

async function checkHermes() {
  try {
    const res = await fetch(`${HERMES_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${HERMES_API_KEY}` },
    });
    return res.ok ? 'reachable' : `error:${res.status}`;
  } catch {
    return 'unreachable';
  }
}

app.listen({ host: '0.0.0.0', port: PORT });
```

---

## 9. STT/TTS設計

### 9.1 STT

候補:

1. OpenAI Whisper API
2. Groq Whisper
3. local faster-whisper
4. macOS音声認識 / 別プロセス

Bridge Serverでは、G2から来たPCMをWAV化してSTTへ渡す。

ffmpeg例:

```bash
ffmpeg -f s16le -ar 16000 -ac 1 -i input.pcm output.wav
```

Node.jsからは一時ファイルに保存し、`ffmpeg`実行、STT APIへ送信する形が最短。

### 9.2 TTS

G2にスピーカーがないため、TTSの使い方は2パターン。

#### A. Macで読み上げ

最短:

```bash
say "返答テキスト"
```

Bridge ServerでHermes返答後に`child_process.spawn('say', [text])`する。

メリット:

- すぐ動く
- API不要

デメリット:

- Macの近くでないと聞こえない
- iPhone/G2側からは音が出ない

#### B. audioUrlを返してスマホWebViewで再生

Bridge ServerがTTS音声ファイルを生成して`audioUrl`を返し、WebViewで再生する。

ただし:

- スマホWebViewの自動再生制約がある。
- G2にはスピーカーがない。
- iPhone側から音が出る想定になる。

---

## 10. ネットワーク構成

### 10.1 ローカル開発

```text
Even Realities App on phone
  → http://MacのLAN IP:8787
Mac Bridge Server
  → http://127.0.0.1:8642/v1
Hermes API Server
```

手順:

1. MacのIP確認

```bash
ipconfig getifaddr en0
```

2. Bridge Server起動

```bash
npm run dev
```

3. `app.json` whitelistに`http://MacIP:8787`を追加
4. QR sideloadで実機確認

### 10.2 常用構成

推奨:

```text
Even Hub plugin
  → https://g2-bridge.example.com
Cloudflare Tunnel / ngrok
  → http://localhost:8787 on Mac
Mac Bridge Server
  → http://127.0.0.1:8642/v1
Hermes API Server
```

Cloudflare Tunnel例:

```bash
cloudflared tunnel --url http://localhost:8787
```

本番運用では固定ドメイン化する。

メリット:

- HTTPS対応しやすい
- iPhoneが外部回線でも到達可能
- `app.json` whitelistを安定化できる

デメリット:

- Macが起動している必要がある
- 認証を必ず入れる必要がある
- レイテンシが増える

---

## 11. セキュリティ設計

最低限必要:

- `Authorization: Bearer <bridge-token>`
- HTTPS
- CORS origin制限
- ログに音声/個人情報/認証情報を出しすぎない
- Hermes API Serverの`API_SERVER_KEY`をWebViewへ出さない
- Bridge TokenとHermes API Keyを分ける

推奨:

- Bridge Tokenは短い固定文字列ではなく32文字以上のランダム値
- 将来的にはHMAC署名または短命JWT
- `/health`以外は認証必須
- 音声バッファは処理後すぐ削除
- rate limit導入

---

## 12. 操作UX案

最初の実装は以下で十分。

- `Ask`: テキスト固定プロンプトまたは音声録音開始
- `Next`: 次ページ表示
- `Exit`: 終了

音声版:

- press/Ask: 録音開始
- もう一度press/Ask: 録音終了 → STT → Hermes
- swipe up/down: ページ送り
- double press: cancel/exit

G2表示例:

```text
Listening...
```

```text
Transcribing...
```

```text
Thinking...
```

```text
13:00 会議があります。
Nextで詳細。
```

---

## 13. 実装ステップ

### Phase 1: テキストBridge

- [ ] Hermes API Serverを有効化
- [ ] Bridge Server `/health`を実装
- [ ] Bridge Server `/v1/ask`を実装
- [ ] Even Hub pluginから`fetch('/v1/ask')`
- [ ] G2に返答表示

これで「G2からHermesにテキスト問い合わせ」は成立。

### Phase 2: ページング/UX

- [ ] 90字程度でページ分割
- [ ] `Next`操作でページ送り
- [ ] `Thinking...`など状態表示
- [ ] Hermesへのsystem/instructionsで短答化

### Phase 3: G2マイク入力

- [ ] `g2-microphone` permission追加
- [ ] `audioControl(true)`を実装
- [ ] `audioEvent.audioPcm`をログ確認
- [ ] PCMをBridge Serverへ送信
- [ ] WAV化/STT
- [ ] transcriptをHermesへ送信

### Phase 4: TTS

- [ ] Mac側`say`で読み上げ
- [ ] 必要なら音声ファイル生成
- [ ] WebView再生可否を検証

### Phase 5: 常用化

- [ ] Cloudflare Tunnel固定ドメイン
- [ ] HTTPS whitelist
- [ ] token/JWT
- [ ] エラー・タイムアウト処理
- [ ] ログ/メトリクス

---

## 14. 検証チェックリスト

### Even Hub plugin

- [ ] `createStartUpPageContainer`が成功値`0`を返す
- [ ] `textContainerUpgrade`で表示更新できる
- [ ] 操作イベントが`onEvenHubEvent`に届く
- [ ] `fetch`がCORS/whitelistでブロックされない
- [ ] 長文を送っても2000文字制限に引っかからない

### Bridge Server

- [ ] `GET /health`がスマホから到達可能
- [ ] `POST /v1/ask`が200を返す
- [ ] tokenなしで401になる
- [ ] Hermes停止時にわかりやすいエラーを返す
- [ ] timeoutを設けてG2側を待たせすぎない

### Hermes

- [ ] `hermes gateway`起動時にAPI Serverが有効
- [ ] `curl /v1/responses`で返答が取れる
- [ ] `previous_response_id`で会話継続できる
- [ ] G2用に短く返すinstructionsが効く

### Audio

- [ ] `audioEvent.audioPcm`が届く
- [ ] sample rate / endian / channel数を確認
- [ ] WAV化できる
- [ ] STTのtranscriptが妥当
- [ ] 録音終了後にマイクが閉じる

---

## 15. よくあるハマりどころ

### 15.1 whitelistを入れたのに通信できない

`app.json` whitelistはCORS回避ではない。Bridge Server側でCORS headersが必要。

最低限:

```http
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

本番は`*`ではなくEven Hub WebViewのorigin/自ドメインに絞る。

### 15.2 Macのlocalhostにスマホから接続できない

スマホWebViewから見た`localhost`はスマホ自身。Macではない。

ローカル開発では:

```text
http://MacのLAN IP:8787
```

を使う。

### 15.3 G2に音が出ない

G2にはスピーカーがない。音声返答はMacまたはスマホ側で再生する必要がある。

### 15.4 `createStartUpPageContainer`を何度も呼んで動かない

初回のみ。2回目以降は`rebuildPageContainer`または`textContainerUpgrade`を使う。

### 15.5 画像/頻繁な更新が不安定

SDK READMEでは画像更新は並列送信せずキュー化推奨。G2はメモリが限られるため、高頻度更新は避ける。

### 15.6 Hermes応答が長すぎる

Bridge Server側で以下を入れる。

- instructionsで短答化
- `paginateForG2()`でページ分割
- 箇条書き最大3つ
- 「詳細はスマホ/Macで確認」導線

---

## 16. 最短PoC手順

1. Hermes API Serverを有効化

```bash
cat >> ~/.hermes/.env <<'EOF'
API_SERVER_ENABLED=true
API_SERVER_KEY=change-me-local-dev
EOF
hermes gateway
```

2. 別ターミナルで疎通

```bash
curl http://127.0.0.1:8642/v1/responses \
  -H 'Authorization: Bearer change-me-local-dev' \
  -H 'Content-Type: application/json' \
  -d '{"model":"hermes-agent","input":"G2向けに短く自己紹介して","store":true}'
```

3. Bridge Serverを起動

```bash
PORT=8787 \
BRIDGE_TOKEN=dev-token \
HERMES_BASE_URL=http://127.0.0.1:8642/v1 \
HERMES_API_KEY=change-me-local-dev \
npx tsx server.ts
```

4. スマホからMacのBridgeへ到達確認

```text
http://MacのLAN IP:8787/health
```

5. Even Hub pluginから`POST /v1/ask`

6. G2に返答表示

---

## 17. 推奨ディレクトリ構成

既存Even HubアプリにBridge clientを追加する場合:

```text
g2-app/
├── app.json
├── src/
│   ├── main.ts
│   ├── even/
│   │   ├── bridge.ts          # waitForEvenAppBridge wrapper
│   │   ├── display.ts         # textContainerUpgrade/paging
│   │   └── audio.ts           # audioControl/audioEvent
│   └── api/
│       └── bridgeClient.ts    # Mac Bridge Server API client
└── package.json
```

Mac Bridge Server:

```text
g2-hermes-bridge/
├── src/
│   ├── server.ts
│   ├── hermesClient.ts
│   ├── stt.ts
│   ├── tts.ts
│   ├── auth.ts
│   └── paginate.ts
├── .env
├── package.json
└── tsconfig.json
```

---

## 18. 実装方針メモ

ヨッシーの用途なら、まずは以下の順がよい。

1. **テキストBridgeだけ作る**
   - SDKアプリの操作イベント → `/v1/ask` → G2表示
2. **固定文ではなくスマホWebView側入力/プリセット質問を選べるようにする**
3. **G2マイクPCMをログで確認**
4. **STTを接続**
5. **Mac側TTS再生を追加**

いきなり音声ストリーミングから入ると、PCM形式・chunk欠落・WebView制約・STT遅延・Hermes応答待ちが一気に絡む。PoCはテキストから始めるのが安全。

---

## 19. 未確認・実機検証が必要な点

- `audioEvent.audioPcm`の厳密なPCM形式
  - 公式Overviewでは16kHz PCM streamとあるが、signed/endianness/channelは実機ログで確認する。
- WebView上で長時間`audioControl(true)`したときの安定性
- iOS/WKWebViewでのWebSocket安定性
- Cloudflare Tunnel経由時の遅延
- TTS音声をスマホWebViewで自然に再生できるか
- G2操作イベントの実際の割り当て

---

## 20. まとめ

このブリッジアプリは、Even Hub SDKアプリそのものを重くするより、**薄いG2クライアント + Mac Bridge Server**に分けるのが正解。

最小構成:

```text
G2操作 → Even Hub plugin → POST /v1/ask → Bridge Server → Hermes /v1/responses → G2テキスト表示
```

音声構成:

```text
G2 mic PCM → Bridge Server → STT → Hermes → 短文化 → G2表示 + Mac/スマホTTS
```

まず作るべきものは、音声ではなく**テキストBridgeのPoC**。これが動けば、G2マイク、STT、TTSは段階的に追加できる。
