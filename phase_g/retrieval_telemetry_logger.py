from __future__ import annotations

from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any, Dict, List, Optional


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _normalize_text_lower(value: Any) -> str:
    return _normalize_text(value).lower()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


# Dev/runtime default storage. Replace with Firebase collection in production integration.
RETRIEVAL_TELEMETRY_LOGS: List[Dict[str, Any]] = []


@dataclass
class RetrievalTelemetryRecord:
    log_id: str
    created_at: str
    query: str
    intent: str
    pipeline: str
    tenant_id: str
    clinic_id: Optional[str]
    branch_id: Optional[str]
    retrieval_mode: str
    source: str
    fallback_used: bool
    clinic_result_count: int
    global_result_count: int
    merged_result_count: int
    top_scores: List[float] = field(default_factory=list)
    top_scopes: List[str] = field(default_factory=list)
    top_source_types: List[str] = field(default_factory=list)
    response_passed_policy: Optional[bool] = None
    response_violations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RetrievalTelemetryLogger:
    def log_retrieval(
        self,
        query: str,
        intent: str,
        pipeline: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        router_result: Dict[str, Any],
        response_policy_evaluation: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        router_result = _safe_dict(router_result)
        results = _safe_dict(router_result.get("results"))
        clinic_results = _safe_list(results.get("clinic_results"))
        global_results = _safe_list(results.get("global_results"))
        merged_results = _safe_list(results.get("merged_results"))

        top_scores: List[float] = []
        top_scopes: List[str] = []
        top_source_types: List[str] = []

        for item in merged_results[:5]:
            item_dict = _safe_dict(item)
            meta = _safe_dict(item_dict.get("metadata"))
            score = item_dict.get("score")
            try:
                top_scores.append(float(score))
            except Exception:
                top_scores.append(0.0)
            top_scopes.append(_normalize_text_lower(meta.get("scope")))
            top_source_types.append(_normalize_text_lower(meta.get("source_type")))

        evaluation = _safe_dict(response_policy_evaluation)
        record = RetrievalTelemetryRecord(
            log_id=f"rtl_{len(RETRIEVAL_TELEMETRY_LOGS) + 1}",
            created_at=_now_iso(),
            query=_normalize_text(query),
            intent=_normalize_text_lower(intent),
            pipeline=_normalize_text_lower(pipeline),
            tenant_id=_normalize_text(tenant_id),
            clinic_id=_normalize_text(clinic_id) or None,
            branch_id=_normalize_text(branch_id) or None,
            retrieval_mode=_normalize_text_lower(router_result.get("mode")),
            source=_normalize_text_lower(router_result.get("source")),
            fallback_used=bool(router_result.get("fallback_used", False)),
            clinic_result_count=len(clinic_results),
            global_result_count=len(global_results),
            merged_result_count=len(merged_results),
            top_scores=top_scores,
            top_scopes=top_scopes,
            top_source_types=top_source_types,
            response_passed_policy=evaluation.get("passed") if evaluation else None,
            response_violations=_safe_list(evaluation.get("violations")) if evaluation else [],
            metadata=_safe_dict(metadata),
        )
        RETRIEVAL_TELEMETRY_LOGS.append(record.to_dict())
        return record.to_dict()

    def list_logs(
        self,
        tenant_id: Optional[str] = None,
        clinic_id: Optional[str] = None,
        intent: Optional[str] = None,
        pipeline: Optional[str] = None,
        fallback_only: bool = False,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        for item in reversed(RETRIEVAL_TELEMETRY_LOGS):
            if tenant_id and _normalize_text(item.get("tenant_id")) != _normalize_text(tenant_id):
                continue
            if clinic_id and _normalize_text(item.get("clinic_id")) != _normalize_text(clinic_id):
                continue
            if intent and _normalize_text_lower(item.get("intent")) != _normalize_text_lower(intent):
                continue
            if pipeline and _normalize_text_lower(item.get("pipeline")) != _normalize_text_lower(pipeline):
                continue
            if fallback_only and not bool(item.get("fallback_used", False)):
                continue
            results.append(item)
            if len(results) >= limit:
                break
        return results

    def summarize_logs(self, tenant_id: Optional[str] = None, clinic_id: Optional[str] = None) -> Dict[str, Any]:
        logs = self.list_logs(tenant_id=tenant_id, clinic_id=clinic_id, limit=100000)
        total = len(logs)
        fallback_count = sum(1 for x in logs if bool(x.get("fallback_used")))
        passed_policy_count = sum(1 for x in logs if x.get("response_passed_policy") is True)
        failed_policy_count = sum(1 for x in logs if x.get("response_passed_policy") is False)
        avg_merged_results = (
            round(sum(int(x.get("merged_result_count", 0)) for x in logs) / total, 2) if total > 0 else 0.0
        )

        intent_counts: Dict[str, int] = {}
        pipeline_counts: Dict[str, int] = {}
        source_type_counts: Dict[str, int] = {}
        scope_counts: Dict[str, int] = {}

        for item in logs:
            intent_key = _normalize_text_lower(item.get("intent"))
            pipeline_key = _normalize_text_lower(item.get("pipeline"))
            intent_counts[intent_key] = intent_counts.get(intent_key, 0) + 1
            pipeline_counts[pipeline_key] = pipeline_counts.get(pipeline_key, 0) + 1

            for st in _safe_list(item.get("top_source_types")):
                normalized_st = _normalize_text_lower(st)
                source_type_counts[normalized_st] = source_type_counts.get(normalized_st, 0) + 1

            for sc in _safe_list(item.get("top_scopes")):
                normalized_sc = _normalize_text_lower(sc)
                scope_counts[normalized_sc] = scope_counts.get(normalized_sc, 0) + 1

        return {
            "generated_at": _now_iso(),
            "tenant_id": tenant_id,
            "clinic_id": clinic_id,
            "total_logs": total,
            "fallback_count": fallback_count,
            "passed_policy_count": passed_policy_count,
            "failed_policy_count": failed_policy_count,
            "avg_merged_results": avg_merged_results,
            "intent_counts": intent_counts,
            "pipeline_counts": pipeline_counts,
            "source_type_counts": source_type_counts,
            "scope_counts": scope_counts,
        }


_default_logger = RetrievalTelemetryLogger()


def log_retrieval_telemetry(
    query: str,
    intent: str,
    pipeline: str,
    tenant_id: str,
    clinic_id: Optional[str],
    branch_id: Optional[str],
    router_result: Dict[str, Any],
    response_policy_evaluation: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return _default_logger.log_retrieval(
        query=query,
        intent=intent,
        pipeline=pipeline,
        tenant_id=tenant_id,
        clinic_id=clinic_id,
        branch_id=branch_id,
        router_result=router_result,
        response_policy_evaluation=response_policy_evaluation,
        metadata=metadata,
    )


def list_retrieval_telemetry_logs(
    tenant_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
    intent: Optional[str] = None,
    pipeline: Optional[str] = None,
    fallback_only: bool = False,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    return _default_logger.list_logs(
        tenant_id=tenant_id,
        clinic_id=clinic_id,
        intent=intent,
        pipeline=pipeline,
        fallback_only=fallback_only,
        limit=limit,
    )


def summarize_retrieval_telemetry(
    tenant_id: Optional[str] = None,
    clinic_id: Optional[str] = None,
) -> Dict[str, Any]:
    return _default_logger.summarize_logs(tenant_id=tenant_id, clinic_id=clinic_id)
