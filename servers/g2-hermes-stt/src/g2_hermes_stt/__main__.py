import os
import sys
import threading
from typing import TextIO

from .server import ModelState, SttServer
from .transcribe import Recognizer
from .whisper import DEFAULT_REPO, make_recognizer, warm

# loopback 専用。外部公開しない設計なので bind host は設定で上書きさせずハードコードする。
HOST = "127.0.0.1"


def warm_and_flag(
    recognizer: Recognizer,
    state: ModelState,
    model: str,
    *,
    out: TextIO = sys.stdout,
    err: TextIO = sys.stderr,
) -> None:
    """warm ロードして成功時のみ loaded=True にする。失敗は握り潰さず stderr に出す。"""
    try:
        warm(recognizer)
    except Exception as exc:  # noqa: BLE001 — どんな失敗でも黙って 503 固着させない
        print(f"[g2-hermes-stt] ERROR: model load failed: {exc}", file=err, flush=True)
        return
    state.loaded = True
    print(f"[g2-hermes-stt] model loaded: {model}", file=out, flush=True)


def main() -> None:
    port = int(os.environ.get("STT_PORT", "8643"))
    repo = os.environ.get("STT_MODEL_REPO", DEFAULT_REPO)
    model = repo.rsplit("/", 1)[-1]

    state = ModelState()
    recognizer = make_recognizer(repo)

    threading.Thread(
        target=lambda: warm_and_flag(recognizer, state, model), daemon=True
    ).start()

    server = SttServer((HOST, port), recognizer=recognizer, state=state, model=model)
    print(f"[g2-hermes-stt] listening on http://{HOST}:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
