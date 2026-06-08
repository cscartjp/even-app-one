import numpy as np

from g2_hermes_stt.transcribe import transcribe_wav


def test_returns_cleaned_text_and_ms(make_wav):
    wav = make_wav(np.zeros(16000, dtype=np.float32))  # 1s

    def recognizer(_audio):
        return "  こんにちは  "  # 前後空白は clean で落ちる

    result = transcribe_wav(wav, recognizer)
    assert result["text"] == "こんにちは"
    assert isinstance(result["ms"], int)
    assert result["ms"] >= 0


def test_short_audio_skips_recognizer_and_returns_empty(make_wav):
    wav = make_wav(np.zeros(1600, dtype=np.float32))  # 0.1s < しきい値

    def recognizer(_audio):
        raise AssertionError("極短音声で recognizer を呼んではいけない（幻覚回避）")

    result = transcribe_wav(wav, recognizer)
    assert result == {"text": "", "ms": 0}
