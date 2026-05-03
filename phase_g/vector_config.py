from __future__ import annotations

import os
from dataclasses import dataclass, asdict
from typing import Dict


@dataclass
class VectorConfig:
    provider: str
    persist_dir: str
    collection_name: str

    def to_dict(self) -> Dict[str, str]:
        return asdict(self)


def load_vector_config() -> VectorConfig:
    provider = (os.getenv("VECTOR_DB_PROVIDER") or "chroma").strip().lower()
    persist_dir = (os.getenv("CHROMA_PERSIST_DIR") or "./.chroma").strip()
    collection_name = (os.getenv("CHROMA_COLLECTION_NAME") or "clinic_vectors").strip()
    return VectorConfig(
        provider=provider,
        persist_dir=persist_dir,
        collection_name=collection_name,
    )
