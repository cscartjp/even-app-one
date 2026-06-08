import io

from g2_hermes_stt.__main__ import warm_and_flag
from g2_hermes_stt.server import ModelState


def test_warm_and_flag_sets_loaded_on_success():
    state = ModelState()
    out = io.StringIO()
    warm_and_flag(lambda _a: "", state, "m", out=out, err=io.StringIO())
    assert state.loaded is True
    assert "model loaded" in out.getvalue()


def test_warm_and_flag_keeps_unloaded_and_logs_on_failure():
    state = ModelState()
    err = io.StringIO()

    def boom(_a):
        raise RuntimeError("model files missing")

    warm_and_flag(boom, state, "m", out=io.StringIO(), err=err)
    assert state.loaded is False  # 失敗時は loaded を立てない（/health で検知できる）
    assert "model load failed" in err.getvalue()
