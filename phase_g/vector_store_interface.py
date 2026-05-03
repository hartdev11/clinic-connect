from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

from vector_models import (
    IndexingResult,
    VectorQueryRequest,
    VectorQueryResponse,
    VectorQueryResultItem,
    VectorRecord,
)


@runtime_checkable
class VectorStoreInterface(Protocol):
    def provider_name(self) -> str:
        ...

    def query_similar(
        self,
        request: VectorQueryRequest,
        query_embedding: List[float],
    ) -> VectorQueryResponse:
        ...

    def upsert_records(self, records: List[VectorRecord]) -> IndexingResult:
        ...

    def delete_by_document(
        self,
        document_id: str,
        tenant_id: Optional[str],
        clinic_id: Optional[str],
        branch_id: Optional[str] = None,
    ) -> IndexingResult:
        ...


@dataclass
class InMemoryVectorRecord:
    id: str
    text: str
    embedding: List[float]
    metadata: Dict[str, Any] = field(default_factory=dict)


def _dot(a: List[float], b: List[float]) -> float:
    size = min(len(a), len(b))
    return sum(a[i] * b[i] for i in range(size))


def _norm(v: List[float]) -> float:
    return math.sqrt(sum(x * x for x in v))


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    na = _norm(a)
    nb = _norm(b)
    if na == 0.0 or nb == 0.0:
        return 0.0
    return _dot(a, b) / (na * nb)


class InMemoryVectorStore(VectorStoreInterface):
    """
    Minimal in-memory vector store for local runtime / tests.
    Records are expected to include metadata fields used in filters:
    - scope
    - tenant_id
    - clinic_id
    - source_type
    - is_active
    """

    def __init__(self, records: Optional[List[InMemoryVectorRecord]] = None) -> None:
        self.records: List[InMemoryVectorRecord] = records or []
        self._provider = "in-memory-vector-store"

    def provider_name(self) -> str:
        return self._provider

    @staticmethod
    def _matches_filters(metadata: Dict[str, Any], filters: Dict[str, Any]) -> bool:
        for key, expected in filters.items():
            if expected is None:
                continue
            if metadata.get(key) != expected:
                return False
        return True

    def query_similar(
        self,
        request: VectorQueryRequest,
        query_embedding: List[float],
    ) -> VectorQueryResponse:
        candidates: List[VectorQueryResultItem] = []
        required_source_types = set(request.source_types or [])

        for rec in self.records:
            meta = rec.metadata or {}
            if required_source_types and str(meta.get("source_type") or "") not in required_source_types:
                continue
            if not self._matches_filters(meta, request.filters or {}):
                continue
            score = _cosine_similarity(query_embedding, rec.embedding)
            if score < float(request.min_score_threshold or 0.0):
                continue
            candidates.append(
                VectorQueryResultItem(
                    id=rec.id,
                    text=rec.text,
                    score=score,
                    metadata=meta,
                )
            )

        candidates.sort(key=lambda x: x.score, reverse=True)
        return VectorQueryResponse(
            results=candidates[: max(1, int(request.top_k or 1))],
            debug={
                "scope": request.scope,
                "requested_top_k": request.top_k,
                "matched": len(candidates),
            },
        )

    def upsert_records(self, records: List[VectorRecord]) -> IndexingResult:
        upserted = 0
        by_id = {r.id: r for r in self.records}
        for record in records:
            meta = record.metadata.to_dict()
            by_id[record.id] = InMemoryVectorRecord(
                id=record.id,
                text=record.text,
                embedding=list(record.embedding),
                metadata=meta,
            )
            upserted += 1
        self.records = list(by_id.values())
        return IndexingResult(
            action="upsert_records",
            success=True,
            indexed_count=upserted,
            skipped_count=0,
            provider=self.provider_name(),
        )

    def delete_by_document(
        self,
        document_id: str,
        tenant_id: Optional[str],
        clinic_id: Optional[str],
        branch_id: Optional[str] = None,
    ) -> IndexingResult:
        before = len(self.records)
        kept: List[InMemoryVectorRecord] = []
        for rec in self.records:
            md = rec.metadata or {}
            same_doc = str(md.get("document_id") or "") == str(document_id or "")
            same_tenant = str(md.get("tenant_id") or "") == str(tenant_id or "")
            same_clinic = str(md.get("clinic_id") or "") == str(clinic_id or "")
            same_branch = True if branch_id is None else str(md.get("branch_id") or "") == str(branch_id or "")
            if same_doc and same_tenant and same_clinic and same_branch:
                continue
            kept.append(rec)
        self.records = kept
        deleted = before - len(self.records)
        return IndexingResult(
            action="delete_by_document",
            success=True,
            indexed_count=0,
            skipped_count=0,
            provider=self.provider_name(),
            errors=[],
            document_id=document_id,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
        )
