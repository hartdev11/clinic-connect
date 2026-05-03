from __future__ import annotations

from typing import Optional, List

from vector_store_interface import InMemoryVectorStore, InMemoryVectorRecord, VectorStoreInterface


def create_vector_store(provider: str = "chroma", seed_records: Optional[List[InMemoryVectorRecord]] = None) -> VectorStoreInterface:
    normalized = (provider or "chroma").strip().lower()
    # Current runtime default: in-memory implementation compatible with VectorStoreInterface.
    # Can be replaced with Chroma/Pinecone adapter later without changing call sites.
    if normalized in {"chroma", "pinecone", "memory"}:
        return InMemoryVectorStore(records=seed_records or [])
    return InMemoryVectorStore(records=seed_records or [])


def get_vector_store(validate_config_first: bool = True, validate_implementation: bool = False) -> VectorStoreInterface:
    # Compatibility helper for integration snippets.
    # validate_* flags are accepted for future adapters.
    _ = validate_config_first
    _ = validate_implementation
    return create_vector_store(provider="chroma")
