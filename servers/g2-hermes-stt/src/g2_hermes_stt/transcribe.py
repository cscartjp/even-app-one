import time
from collections.abc import Callable

import numpy as np

from .audio import EXPECTED_RATE, decode_wav
from .text import clean

# 0.3 秒未満は whisper が幻覚テキストを返しやすいので、推論せず空文字で弾く。
# 通常の無音/極短はクライアント側の閾値（3.3.2）でも弾く二段構え。
MIN_SAMPLES = int(EXPECTED_RATE * 0.3)

Recognizer = Callable[[np.ndarray], str]


def transcribe_wav(data: bytes, recognizer: Recognizer) -> dict:
    """WAV bytes を文字起こしして `{"text", "ms"}` を返す。recognizer は注入（テスト可能化）。"""
    audio = decode_wav(data)
    if len(audio) < MIN_SAMPLES:
        return {"text": "", "ms": 0}

    started = time.perf_counter()
    raw = recognizer(audio)
    ms = round((time.perf_counter() - started) * 1000)
    return {"text": clean(raw), "ms": ms}
