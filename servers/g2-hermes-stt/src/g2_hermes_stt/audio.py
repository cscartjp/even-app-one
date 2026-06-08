import io
import wave

import numpy as np

# Bridge から届く WAV は even-toolkit float32ToWav 出力＝16kHz mono 16bit PCM 固定。
# mlx-whisper は 16kHz float32 を前提とするため、想定外フォーマットは沈黙誤認識ではなく
# 明示エラーにして Bridge 側（502）へ surface する。
EXPECTED_RATE = 16000


def decode_wav(data: bytes) -> np.ndarray:
    """16kHz mono 16bit PCM の WAV bytes を float32 [-1, 1] の波形に変換する。"""
    try:
        with wave.open(io.BytesIO(data), "rb") as wf:
            channels = wf.getnchannels()
            width = wf.getsampwidth()
            rate = wf.getframerate()
            frames = wf.readframes(wf.getnframes())
    except (wave.Error, EOFError) as err:
        raise ValueError(f"invalid WAV: {err}") from err

    if width != 2:
        raise ValueError(f"expected 16bit PCM, got sampwidth={width}")
    if channels != 1:
        raise ValueError(f"expected mono, got nchannels={channels}")
    if rate != EXPECTED_RATE:
        raise ValueError(f"expected {EXPECTED_RATE}Hz, got {rate}Hz")

    return np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
