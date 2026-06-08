import io
import wave

import numpy as np
import pytest

from g2_hermes_stt.audio import decode_wav


def test_decodes_16k_mono_pcm_to_float32(make_wav):
    samples = np.array([0.0, 0.5, -0.5, 1.0, -1.0], dtype=np.float32)
    decoded = decode_wav(make_wav(samples))
    assert decoded.dtype == np.float32
    assert len(decoded) == len(samples)
    assert decoded.max() <= 1.0 and decoded.min() >= -1.0
    np.testing.assert_allclose(decoded, samples, atol=1e-4)


def test_rejects_non_16k_sample_rate(make_wav):
    wav_8k = make_wav(np.zeros(100, dtype=np.float32), rate=8000)
    with pytest.raises(ValueError, match="16000"):
        decode_wav(wav_8k)


def test_rejects_non_wav_bytes():
    with pytest.raises(ValueError, match="WAV"):
        decode_wav(b"this is not a wav file")


def test_rejects_empty_bytes():
    with pytest.raises(ValueError, match="WAV"):
        decode_wav(b"")


def test_rejects_stereo():
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(np.zeros(200, dtype="<i2").tobytes())
    with pytest.raises(ValueError, match="mono"):
        decode_wav(buf.getvalue())
