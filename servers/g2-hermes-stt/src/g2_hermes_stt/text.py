import re

# Mac B の ~/VSCodeProjects/creatorzz/transcribe.py の clean() を流用。
# whisper が末尾などに出す幻覚リピート（同じ 2-12 字の断片が 4 回以上連続）を 1 回に畳む。
_REPEAT = re.compile(r"(.{2,12}?)\1{3,}")


def clean(text: str) -> str:
    return _REPEAT.sub(r"\1", text.strip()).strip()
