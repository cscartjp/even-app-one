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

## 常時自動起動（launchd・Mac B）

Mac B（Hermes / Bridge と同居）でサイドカーを常駐させる手順。ユーザー LaunchAgent（`~/Library/LaunchAgents/`、sudo 不要）。plist は [`deploy/com.frogman.g2hermes-stt.plist`](deploy/com.frogman.g2hermes-stt.plist)。

> **前提**: モデル（`whisper-large-v3-mlx`）は Mac B の `~/ai/models/hub` に DL 済み（`HF_HOME=~/ai/models`）。Bridge と同様、コードは開発機（Mac A）から `~/dev/even-app-one/servers/g2-hermes-stt` に配置する。

```bash
# 1. コードを Mac B へ配置（Mac A から実行。.venv やキャッシュは送らない）
rsync -av --delete \
  --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' --exclude '.pytest_cache' \
  servers/g2-hermes-stt/ \
  yoshiura@<MacB-Tailscale-IP>:~/dev/even-app-one/servers/g2-hermes-stt/

# 2. Mac B で inference extra（mlx-whisper）込みの .venv を構築
cd ~/dev/even-app-one/servers/g2-hermes-stt
uv sync --extra inference          # 依存のみ。モデルは ~/ai/models/hub の DL 済みを使う

# 3. plist を配置して登録
cp deploy/com.frogman.g2hermes-stt.plist ~/Library/LaunchAgents/
pkill -f 'g2_hermes_stt' 2>/dev/null   # 手動起動が残っていれば停止（ポート競合回避）
launchctl load -w ~/Library/LaunchAgents/com.frogman.g2hermes-stt.plist
# 現行 macOS 推奨の bootstrap 系でも可:
#   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.frogman.g2hermes-stt.plist

# 4. 確認（warm ~15s 後に loaded=true）
launchctl list | rg frogman
curl -s http://127.0.0.1:8643/health   # {"ok":true,"model":"whisper-large-v3-mlx","loaded":true}
```

`RunAtLoad`（ログイン時起動）+ `KeepAlive`（クラッシュ時自動復帰）+ `ThrottleInterval`（30s・再起動ループ抑制）。ログは `~/g2stt.log` / `~/g2stt.err`。

### 受け入れ確認（Task 3.1.2）

```bash
# 自動復帰: SIGKILL → KeepAlive で再起動し loaded=true まで戻る（戻りまでの秒数を記録）
kill -9 "$(lsof -nP -iTCP:8643 -sTCP:LISTEN -t)"
sleep 20 && curl -s http://127.0.0.1:8643/health   # loaded=true に戻る

# 強制再ロード後も 200
launchctl kickstart -k gui/$(id -u)/com.frogman.g2hermes-stt
curl -s http://127.0.0.1:8643/health

# loopback 実証: 別ホスト（Mac A 等）から Tailscale IP:8643 へは接続不可であること
#   curl http://<MacB-Tailscale-IP>:8643/health   # connection refused / timeout になるのが正
```

停止・解除は `launchctl unload -w ~/Library/LaunchAgents/com.frogman.g2hermes-stt.plist`（modern 系なら `launchctl bootout gui/$(id -u)/com.frogman.g2hermes-stt`）。

> **注意**: macOS のユーザー LaunchAgent は **GUI ログイン時**に起動する。Mac B が自動ログイン無効の場合、再起動後に GUI ログインするまでサイドカーは起動しない。

### 別の Mac で使う場合

plist は launchd の仕様上、絶対パスをハードコードしている（`~` / `$HOME` 展開不可）。**別ユーザー名・別パスの Mac に移す場合は、配置前に plist 内の次を書き換える**:

- `ProgramArguments` の `uv` 絶対パス（例 `/Users/yoshiura/.local/bin/uv` → `which uv` の結果）
- `WorkingDirectory`（リポジトリの clone / rsync 先に合わせる）
- `EnvironmentVariables` の `PATH`（`uv` / Homebrew のパス）
- `EnvironmentVariables` の `HF_HOME`（モデルキャッシュの場所。未設定だと再 DL）
- `StandardOutPath` / `StandardErrorPath`

同一ユーザー（`yoshiura`）・同一パス構成の Mac へ移す場合はそのまま `cp` で流用可。
