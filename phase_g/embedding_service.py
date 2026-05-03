from __future__ import annotations

import hashlib
from dataclasses import dataclass, asdict, field
from typing import Any, List, Optional


@dataclass
class EmbeddingResult:
    embedding: List[float]
    model: str
    provider: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class EmbeddingVector:
    embedding: List[float]
    model: str
    embedding_version: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class BatchEmbeddingResult:
    success: bool
    vectors: List[EmbeddingVector] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class EmbeddingService:
    """
    Default embedding service for Phase G runtime.

    Path 1 (preferred): sentence-transformers all-MiniLM-L6-v2
    Path 2 (fallback): deterministic hash embedding (no external dependency)
    """

    def __init__(self, model_name: str = "all-MiniLM-L6-v2", dim: int = 384) -> None:
        self.model_name = model_name
        self.dim = dim
        self._model: Optional[Any] = None
        self._provider = "hash-fallback"

        try:
            from sentence_transformers import SentenceTransformer  # type: ignore

            self._model = SentenceTransformer(model_name)
            self._provider = "sentence-transformers"
        except Exception:
            self._model = None
            self._provider = "hash-fallback"

    def _hash_embedding(self, text: str) -> List[float]:
        # Stable pseudo-embedding: enough for deterministic local ranking fallback.
        v = [0.0] * self.dim
        b = text.encode("utf-8", errors="ignore")
        if not b:
            return v
        for i in range(self.dim):
            seed = hashlib.sha256(b + i.to_bytes(2, "little")).digest()
            # map [0,255] -> [-1,1]
            v[i] = (seed[0] / 127.5) - 1.0
        return v

    def embed_text(self, text: str) -> EmbeddingResult:
        value = str(text or "").strip()
        if self._model is not None:
            emb = self._model.encode(value, normalize_embeddings=True)
            return EmbeddingResult(
                embedding=[float(x) for x in emb.tolist()],
                model=self.model_name,
                provider=self._provider,
            )
        return EmbeddingResult(
            embedding=self._hash_embedding(value),
            model="hash-embedding-v1",
            provider=self._provider,
        )

    def embed_batch(self, texts: List[str]) -> BatchEmbeddingResult:
        if not isinstance(texts, list) or not texts:
            return BatchEmbeddingResult(success=False, errors=["texts is required"])
        vectors: List[EmbeddingVector] = []
        try:
            if self._model is not None:
                arr = self._model.encode([str(t or "").strip() for t in texts], normalize_embeddings=True)
                for vec in arr.tolist():
                    vectors.append(
                        EmbeddingVector(
                            embedding=[float(x) for x in vec],
                            model=self.model_name,
                            embedding_version="v1",
                        )
                    )
            else:
                for t in texts:
                    vectors.append(
                        EmbeddingVector(
                            embedding=self._hash_embedding(str(t or "").strip()),
                            model="hash-embedding-v1",
                            embedding_version="v1",
                        )
                    )
            return BatchEmbeddingResult(success=True, vectors=vectors)
        except Exception as err:
            return BatchEmbeddingResult(success=False, errors=[str(err)])
