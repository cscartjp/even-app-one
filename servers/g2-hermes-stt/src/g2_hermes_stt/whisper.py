import numpy as np

from .audio import EXPECTED_RATE
from .transcribe import Recognizer

DEFAULT_REPO = "mlx-community/whisper-large-v3-mlx"


def make_recognizer(repo: str = DEFAULT_REPO) -> Recognizer:
    """mlx-whisper の transcribe を日本語固定でラップした recognizer を返す。

    mlx-whisper の import は呼び出し時まで遅延する（Apple Silicon + inference extra でのみ必要）。
    """
    import mlx_whisper  # noqa: PLC0415 (lazy: 非 Apple Silicon でも import 失敗させない)

    def recognize(audio: np.ndarray) -> str:
        result = mlx_whisper.transcribe(
            audio, path_or_hf_repo=repo, language="ja", verbose=False
        )
        return result["text"]

    return recognize


def warm(recognizer: Recognizer, *, seconds: float = 1.0) -> None:
    """無音を 1 回流してモデルを常駐させる（mlx-whisper は load_model を内部キャッシュする）。"""
    recognizer(np.zeros(int(EXPECTED_RATE * seconds), dtype=np.float32))
