from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass
class ChunkItem:
    text: str
    chunk_index: int
    section_title: Optional[str]
    strategy: str
    char_count: int

    def to_dict(self) -> Dict[str, object]:
        return asdict(self)


class ChunkingService:
    """
    Simple deterministic chunker for indexing runtime.
    """

    def __init__(self, chunk_size: int = 700, overlap: int = 120) -> None:
        self.chunk_size = max(200, int(chunk_size))
        self.overlap = max(0, min(int(overlap), self.chunk_size // 2))

    def chunk_document(self, content: str, section_title: Optional[str] = None) -> List[ChunkItem]:
        text = str(content or "").strip()
        if not text:
            return []

        chunks: List[ChunkItem] = []
        start = 0
        idx = 0
        n = len(text)
        while start < n:
            end = min(start + self.chunk_size, n)
            piece = text[start:end].strip()
            if piece:
                chunks.append(
                    ChunkItem(
                        text=piece,
                        chunk_index=idx,
                        section_title=section_title,
                        strategy="char_window",
                        char_count=len(piece),
                    )
                )
                idx += 1
            if end >= n:
                break
            start = max(0, end - self.overlap)
        return chunks
