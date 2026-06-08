import json
import threading
import urllib.error
import urllib.request
from contextlib import contextmanager

import numpy as np
import pytest

from g2_hermes_stt.server import ModelState, SttServer

MODEL = "whisper-large-v3-mlx"


@contextmanager
def running_server(*, loaded, recognizer, max_body=8 * 1024 * 1024):
    state = ModelState()
    state.loaded = loaded
    server = SttServer(
        ("127.0.0.1", 0), recognizer=recognizer, state=state, model=MODEL, max_body=max_body
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        host, port = server.server_address
        yield server, f"http://{host}:{port}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _get(url):
    with urllib.request.urlopen(url, timeout=2) as res:  # noqa: S310 (loopback test)
        return res.status, json.loads(res.read())


def _post(url, body, content_type="audio/wav"):
    req = urllib.request.Request(
        url, data=body, method="POST", headers={"Content-Type": content_type}
    )
    try:
        with urllib.request.urlopen(req, timeout=2) as res:  # noqa: S310
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def test_health_reports_loaded_true():
    with running_server(loaded=True, recognizer=lambda a: "") as (_srv, base):
        status, body = _get(f"{base}/health")
    assert status == 200
    assert body == {"ok": True, "model": MODEL, "loaded": True}


def test_binds_loopback_only():
    with running_server(loaded=True, recognizer=lambda a: "") as (srv, _base):
        assert srv.server_address[0] == "127.0.0.1"


def test_transcribe_returns_text_and_ms(make_wav):
    wav = make_wav(np.zeros(16000, dtype=np.float32))
    with running_server(loaded=True, recognizer=lambda a: "やあ") as (_srv, base):
        status, body = _post(f"{base}/transcribe", wav)
    assert status == 200
    assert body["text"] == "やあ"
    assert isinstance(body["ms"], int)


def test_transcribe_returns_503_when_not_loaded(make_wav):
    wav = make_wav(np.zeros(16000, dtype=np.float32))
    with running_server(loaded=False, recognizer=lambda a: "x") as (_srv, base):
        status, _body = _post(f"{base}/transcribe", wav)
    assert status == 503


def test_transcribe_returns_400_on_bad_wav():
    with running_server(loaded=True, recognizer=lambda a: "x") as (_srv, base):
        status, _body = _post(f"{base}/transcribe", b"not a wav")
    assert status == 400


def test_transcribe_returns_413_when_body_exceeds_cap(make_wav):
    wav = make_wav(np.zeros(16000, dtype=np.float32))  # ~32KB
    with running_server(loaded=True, recognizer=lambda a: "x", max_body=100) as (_srv, base):
        status, _body = _post(f"{base}/transcribe", wav)
    assert status == 413


def test_transcribe_returns_500_when_recognizer_raises(make_wav):
    wav = make_wav(np.zeros(16000, dtype=np.float32))

    def boom(_audio):
        raise RuntimeError("mlx inference failed")

    with running_server(loaded=True, recognizer=boom) as (_srv, base):
        status, _body = _post(f"{base}/transcribe", wav)
    assert status == 500


def test_unknown_path_returns_404():
    with running_server(loaded=True, recognizer=lambda a: "") as (_srv, base):
        with pytest.raises(urllib.error.HTTPError) as exc:
            _get(f"{base}/nope")
    assert exc.value.code == 404
