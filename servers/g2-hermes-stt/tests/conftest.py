import io
import wave

import numpy as np
import pytest


def _make_wav(samples: np.ndarray, rate: int = 16000) -> bytes:
    """even-toolkit float32ToWav と同じ正準フォーマット（PCM mono 16bit）の WAV bytes を作る。

    `samples` は [-1, 1] の float32。テストフィクスチャ用。
    """
    pcm16 = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm16.tobytes())
    return buf.getvalue()


@pytest.fixture
def make_wav():
    return _make_wav
