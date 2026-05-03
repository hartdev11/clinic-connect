from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from embedding_service import EmbeddingService
from vector_models import (
    VectorQueryRequest,
    VectorQueryResponse,
)
from vector_store_interface import VectorStoreInterface


INTENT_SOURCE_TYPE_MAP: Dict[str, List[str]] = {
    "brand_inquiry": [
        "clinic_knowledge",
        "procedure_knowledge",
        "faq_knowledge",
        "promo_knowledge",
    ],
    "pricing": [
        "clinic_knowledge",
        "procedure_knowledge",
        "promo_knowledge",
        "faq_knowledge",
    ],
    "recommendation": [
        "clinic_knowledge",
        "procedure_knowledge",
        "comparison_knowledge",
        "doctor_profile_knowledge",
    ],
    "discovery": [
        "clinic_knowledge",
        "procedure_knowledge",
        "faq_knowledge",
    ],
    "booking": [
        "clinic_knowledge",
        "policy_knowledge",
        "faq_knowledge",
    ],
    "promotion": [
        "promo_knowledge",
        "clinic_knowledge",
        "faq_knowledge",
    ],
    "comparison": [
        "comparison_knowledge",
        "procedure_knowledge",
        "clinic_knowledge",
    ],
    "objection": [
        "faq_knowledge",
        "clinic_knowledge",
        "procedure_knowledge",
    ],
    "safety": [
        "policy_knowledge",
        "procedure_knowledge",
        "faq_knowledge",
    ],
    "doctor_inquiry": [
        "doctor_profile_knowledge",
        "clinic_knowledge",
        "faq_knowledge",
    ],
    "location_hours": [
        "clinic_knowledge",
        "faq_knowledge",
    ],
    "general": [
        "clinic_knowledge",
        "faq_knowledge",
        "procedure_knowledge",
    ],
}

DEFAULT_TOP_K_CLINIC = 5
DEFAULT_TOP_K_GLOBAL = 5
DEFAULT_MIN_SCORE = 0.15


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_text_lower(value: Any) -> str:
    return _normalize_text(value).lower()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


@dataclass
class RetrievalSearchParams:
    query_text: str
    tenant_id: str
    clinic_id: Optional[str] = None
    branch_id: Optional[str] = None
    intent: str = "general"
    pipeline: str = "general_pipeline"
    top_k_clinic: int = DEFAULT_TOP_K_CLINIC
    top_k_global: int = DEFAULT_TOP_K_GLOBAL
    min_score: float = DEFAULT_MIN_SCORE
    language: str = "th"
    extra_filters: Dict[str, Any] = None

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["extra_filters"] = self.extra_filters or {}
        return payload


@dataclass
class RetrievalSearchResult:
    intent: str
    pipeline: str
    clinic_results: List[Dict[str, Any]]
    global_results: List[Dict[str, Any]]
    merged_results: List[Dict[str, Any]]
    reasoning: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RetrievalService:
    """
    Final retrieval service for Phase G runtime.

    - clinic-first retrieval
    - global fallback retrieval
    - intent-aware source filtering
    - merge / dedupe / rank
    """

    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStoreInterface,
    ) -> None:
        self.embedding_service = embedding_service
        self.vector_store = vector_store

    def search_runtime_knowledge(
        self,
        params: RetrievalSearchParams,
    ) -> RetrievalSearchResult:
        query_text = _normalize_text(params.query_text)
        tenant_id = _normalize_text(params.tenant_id)
        clinic_id = _normalize_text(params.clinic_id) or None
        branch_id = _normalize_text(params.branch_id) or None
        intent = _normalize_text_lower(params.intent or "general")
        pipeline = _normalize_text_lower(params.pipeline or "general_pipeline")

        if not query_text:
            raise ValueError("query_text is required")
        if not tenant_id:
            raise ValueError("tenant_id is required")

        source_types = self._resolve_source_types(intent)
        extra_filters = _safe_dict(params.extra_filters)
        emb_result = self.embedding_service.embed_text(query_text)
        query_embedding = emb_result.embedding
        effective_min_score = params.min_score
        # Hash fallback is deterministic but not semantically calibrated like MiniLM;
        # relax threshold to avoid empty retrieval during local/dev fallback mode.
        if getattr(emb_result, "provider", "") == "hash-fallback":
            effective_min_score = min(effective_min_score, -1.0)

        clinic_results = self._search_clinic_scope(
            query_text=query_text,
            query_embedding=query_embedding,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            source_types=source_types,
            top_k=params.top_k_clinic,
            min_score=effective_min_score,
            language=params.language,
            extra_filters=extra_filters,
        )

        global_results = self._search_global_scope(
            query_text=query_text,
            query_embedding=query_embedding,
            source_types=source_types,
            top_k=params.top_k_global,
            min_score=effective_min_score,
            language=params.language,
            extra_filters=extra_filters,
        )

        merged_results = self._merge_rank_results(
            clinic_results=clinic_results,
            global_results=global_results,
        )

        return RetrievalSearchResult(
            intent=intent,
            pipeline=pipeline,
            clinic_results=clinic_results,
            global_results=global_results,
            merged_results=merged_results,
            reasoning="clinic_first_then_global_merge_rank",
        )

    def _search_clinic_scope(
        self,
        query_text: str,
        query_embedding: List[float],
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        source_types: List[str],
        top_k: int,
        min_score: float,
        language: str,
        extra_filters: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        if not clinic_id:
            return []
        request = VectorQueryRequest(
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            query_text=query_text,
            top_k=top_k,
            language=language,
            scope="clinic",
            query_mode="general_search",
            source_types=source_types,
            filters={
                "scope": "clinic",
                "tenant_id": tenant_id,
                "clinic_id": clinic_id,
                "is_active": True,
                **extra_filters,
            },
            min_score_threshold=min_score,
        )
        response = self.vector_store.query_similar(request=request, query_embedding=query_embedding)
        return self._normalize_results(response)

    def _search_global_scope(
        self,
        query_text: str,
        query_embedding: List[float],
        source_types: List[str],
        top_k: int,
        min_score: float,
        language: str,
        extra_filters: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        # Global convention: tenant_id = "global", scope = "global", clinic_id = None
        request = VectorQueryRequest(
            tenant_id="global",
            clinic_id=None,
            branch_id=None,
            query_text=query_text,
            top_k=top_k,
            language=language,
            scope="global",
            query_mode="general_search",
            source_types=source_types,
            filters={
                "scope": "global",
                "is_active": True,
                **extra_filters,
            },
            min_score_threshold=min_score,
        )
        response = self.vector_store.query_similar(request=request, query_embedding=query_embedding)
        return self._normalize_results(response)

    def _normalize_results(self, response: VectorQueryResponse) -> List[Dict[str, Any]]:
        normalized: List[Dict[str, Any]] = []
        for item in response.results:
            normalized.append(
                {
                    "id": _normalize_text(item.id),
                    "text": _normalize_text(item.text),
                    "score": float(item.score),
                    "metadata": _safe_dict(item.metadata),
                }
            )
        return normalized

    def _merge_rank_results(
        self,
        clinic_results: List[Dict[str, Any]],
        global_results: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        boosted: List[Dict[str, Any]] = []
        for item in clinic_results:
            clone = dict(item)
            clone["_effective_score"] = float(item.get("score", 0.0)) + 0.10
            clone["_scope_priority"] = 0
            boosted.append(clone)
        for item in global_results:
            clone = dict(item)
            clone["_effective_score"] = float(item.get("score", 0.0))
            clone["_scope_priority"] = 1
            boosted.append(clone)

        seen_text = set()
        deduped: List[Dict[str, Any]] = []
        for item in sorted(boosted, key=lambda x: (x["_scope_priority"], -x["_effective_score"])):
            text_key = _normalize_text_lower(item.get("text"))
            if not text_key or text_key in seen_text:
                continue
            seen_text.add(text_key)
            deduped.append(item)

        final_sorted = sorted(deduped, key=lambda x: (-x["_effective_score"], x["_scope_priority"]))
        output: List[Dict[str, Any]] = []
        for item in final_sorted:
            output.append(
                {
                    "id": item.get("id"),
                    "text": item.get("text"),
                    "score": item.get("score"),
                    "metadata": item.get("metadata", {}),
                }
            )
        return output

    def _resolve_source_types(self, intent: str) -> List[str]:
        normalized_intent = _normalize_text_lower(intent)
        mapped = INTENT_SOURCE_TYPE_MAP.get(normalized_intent)
        if mapped:
            return mapped
        return INTENT_SOURCE_TYPE_MAP["general"]


def build_runtime_search_params(
    query_text: str,
    tenant_id: str,
    clinic_id: Optional[str],
    branch_id: Optional[str],
    intent: str,
    pipeline: str,
    top_k_clinic: int = DEFAULT_TOP_K_CLINIC,
    top_k_global: int = DEFAULT_TOP_K_GLOBAL,
    min_score: float = DEFAULT_MIN_SCORE,
    language: str = "th",
    extra_filters: Optional[Dict[str, Any]] = None,
) -> RetrievalSearchParams:
    return RetrievalSearchParams(
        query_text=query_text,
        tenant_id=tenant_id,
        clinic_id=clinic_id,
        branch_id=branch_id,
        intent=intent,
        pipeline=pipeline,
        top_k_clinic=top_k_clinic,
        top_k_global=top_k_global,
        min_score=min_score,
        language=language,
        extra_filters=extra_filters or {},
    )
