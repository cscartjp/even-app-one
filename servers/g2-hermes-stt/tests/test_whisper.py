def test_module_imports_without_mlx():
    # mlx-whisper を入れていない環境（Mac A・CI）でも import できること。
    # = mlx の import は make_recognizer() 呼び出し時まで遅延される設計の担保。
    import g2_hermes_stt.whisper as w

    assert w.DEFAULT_REPO == "mlx-community/whisper-large-v3-mlx"
    assert callable(w.make_recognizer)
