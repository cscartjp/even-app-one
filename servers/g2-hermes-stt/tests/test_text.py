from g2_hermes_stt.text import clean


def test_collapses_4plus_repeats_to_single():
    # whisper が末尾で同じ断片を 4 回以上繰り返す幻覚を 1 回に畳む
    assert clean("テスト" * 5) == "テスト"


def test_keeps_3_repeats_untouched():
    # 3 回までは正当な反復とみなして残す（しきい値は 4 回以上）
    assert clean("はいはいはい") == "はいはいはい"


def test_leaves_normal_text_unchanged():
    assert clean("今日はいい天気です") == "今日はいい天気です"


def test_strips_surrounding_whitespace():
    assert clean("  おはよう  ") == "おはよう"
