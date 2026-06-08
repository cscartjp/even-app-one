# g2-hermes-stt

Even G2 Hermes Bridge の **STT サイドカー**。Mac B（Apple Silicon）に常駐し、Bridge から
WAV を受けて mlx-whisper（`whisper-large-v3-mlx`）でローカル文字起こしする loopback 専用の小さな HTTP サービス。

- **音声を外部クラウドに出さない**（ローカル mlx-whisper のみ）
- **127.0.0.1 専用 bind**。Bridge（同一 Mac）だけが叩く
- 設計正本: `docs/spec/g2-hermes-phase3-voice.md` §4.1 / task: `Plans.md` Phase 3.1

## I/F

| method | path | body / resp |
|---|---|---|
| `POST` | `/transcribe` | req: WAV bytes（`audio/wav`・16kHz mono 16bit PCM）→ resp: `{ "text": string, "ms": number }` |
| `GET` | `/health` | `{ "ok": true, "model": "whisper-large-v3-mlx", "loaded": bool }` |

## 開発（Mac A・推論なし）

ピュア関数（WAV デコード・幻覚除去・ルーティング契約）は mlx 無しで検証できる。

```bash
cd servers/g2-hermes-stt
uv run ruff check
uv run pytest -q
```

## 実行（Mac B・推論あり）

mlx-whisper は `inference` extra に分離している（重く Apple Silicon 限定のため）。

```bash
uv sync --extra inference          # mlx-whisper を含めて環境構築
uv run --extra inference python -m g2_hermes_stt
# HF キャッシュは ~/ai/models（モデル DL 済み）。必要なら HF_HOME=~/ai/models を設定
```

環境変数: `STT_PORT`（既定 8643）/ `STT_MODEL_REPO`（既定 `mlx-community/whisper-large-v3-mlx`）。
bind は `127.0.0.1` 固定（loopback 専用・設定で上書き不可）。

常駐化（launchd `com.frogman.g2hermes-stt`）は Task 3.1.2 で `deploy/` に追加。
