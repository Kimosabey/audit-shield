from __future__ import annotations

import re
import unicodedata

# Zero-width / format chars that survive str.strip() but carry no ingestable text
_ZERO_WIDTH = re.compile(r"[\u200b\u200c\u200d\ufeff\u2060\u00ad]")


def normalize_ingest_text(text: str) -> str:
    """Normalize PDF/decoded bytes so empty checks and chunk boundaries are consistent."""
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text)
    t = t.replace("\r\n", "\n").replace("\r", "\n")
    t = _ZERO_WIDTH.sub("", t)
    return t.strip()


def chunk_text(
    text: str,
    *,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> list[str]:
    t = normalize_ingest_text(text)
    if not t:
        return []
    if chunk_size < 100:
        chunk_size = 100
    if overlap < 0 or overlap >= chunk_size:
        overlap = min(200, chunk_size // 4)
    chunks: list[str] = []
    i = 0
    n = len(t)
    while i < n:
        end = min(i + chunk_size, n)
        piece = t[i:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        next_i = end - overlap
        if next_i <= i:
            next_i = end
        i = next_i
    return chunks
