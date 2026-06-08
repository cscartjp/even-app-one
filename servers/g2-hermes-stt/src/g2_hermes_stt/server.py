import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

from .transcribe import Recognizer, transcribe_wav


class ModelState:
    """warm ロード完了フラグ。ロードスレッドが loaded=True にする。"""

    def __init__(self) -> None:
        self.loaded = False


def health_payload(loaded: bool, model: str) -> dict:
    return {"ok": True, "model": model, "loaded": loaded}


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args) -> None:  # アクセスログは出さない
        pass

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        server: SttServer = self.server  # type: ignore[assignment]
        if self.path == "/health":
            self._send(200, health_payload(server.state.loaded, server.model))
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        server: SttServer = self.server  # type: ignore[assignment]
        if self.path != "/transcribe":
            self._send(404, {"error": "not found"})
            return
        if not server.state.loaded:
            self._send(503, {"error": "model not loaded"})
            return
        raw_len = self.headers.get("Content-Length")
        if raw_len is None:
            self._send(411, {"error": "Content-Length required"})
            return
        try:
            length = int(raw_len)
        except ValueError:
            self._send(400, {"error": "invalid Content-Length"})
            return
        if length > server.max_body:
            self._send(413, {"error": "payload too large"})
            return
        body = self.rfile.read(length) if length else b""
        try:
            result = transcribe_wav(body, server.recognizer)
        except ValueError as err:
            self._send(400, {"error": str(err)})
            return
        except Exception as err:  # noqa: BLE001 — 実行時推論エラーは 500（Bridge が 502 にマップ）
            print(f"[g2-hermes-stt] transcribe error: {err}", file=sys.stderr, flush=True)
            self._send(500, {"error": "transcription failed"})
            return
        self._send(200, result)


class SttServer(HTTPServer):
    """単一スレッドの HTTPServer。リクエストは自然に直列化される（mlx 推論の競合回避）。"""

    # launchd KeepAlive での即時再起動が TIME_WAIT の "Address already in use" で失敗しないように。
    allow_reuse_address = True

    def __init__(
        self,
        address: tuple[str, int],
        *,
        recognizer: Recognizer,
        state: ModelState,
        model: str,
        max_body: int = 8 * 1024 * 1024,
    ) -> None:
        super().__init__(address, _Handler)
        self.recognizer = recognizer
        self.state = state
        self.model = model
        self.max_body = max_body
