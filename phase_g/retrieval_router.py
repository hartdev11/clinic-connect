from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

from retrieval_service import RetrievalService, RetrievalSearchResult, build_runtime_search_params


DEFAULT_MODE = "chroma_only"
ENABLE_FALLBACK = True


@dataclass
class RetrievalRouterResult:
    success: bool
    mode: str
    intent: str
    pipeline: str
    results: Dict[str, Any]
    source: str
    fallback_used: bool
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RetrievalRouter:
    def __init__(self, retrieval_service: RetrievalService, mode: str = DEFAULT_MODE) -> None:
        self.retrieval_service = retrieval_service
        self.mode = mode

    def route(
        self,
        user_message: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        intent: str,
        pipeline: str,
    ) -> RetrievalRouterResult:
        try:
            if self.mode == "chroma_only":
                return self._run_chroma_path(
                    user_message, tenant_id, clinic_id, branch_id, intent, pipeline
                )
            if self.mode == "hybrid":
                return self._run_hybrid_path(
                    user_message, tenant_id, clinic_id, branch_id, intent, pipeline
                )
            return RetrievalRouterResult(
                success=False,
                mode=self.mode,
                intent=intent,
                pipeline=pipeline,
                results={},
                source="unknown",
                fallback_used=False,
                error=f"unsupported mode: {self.mode}",
            )
        except Exception as e:
            if ENABLE_FALLBACK:
                return self._fallback_to_safe_mode(
                    user_message, tenant_id, clinic_id, branch_id, intent, pipeline, error=str(e)
                )
            return RetrievalRouterResult(
                success=False,
                mode=self.mode,
                intent=intent,
                pipeline=pipeline,
                results={},
                source="error",
                fallback_used=False,
                error=str(e),
            )

    def _run_chroma_path(
        self,
        user_message: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        intent: str,
        pipeline: str,
    ) -> RetrievalRouterResult:
        params = build_runtime_search_params(
            query_text=user_message,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            intent=intent,
            pipeline=pipeline,
        )
        result: RetrievalSearchResult = self.retrieval_service.search_runtime_knowledge(params)
        return RetrievalRouterResult(
            success=True,
            mode="chroma_only",
            intent=intent,
            pipeline=pipeline,
            results=result.to_dict(),
            source="chroma",
            fallback_used=False,
        )

    def _run_hybrid_path(
        self,
        user_message: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        intent: str,
        pipeline: str,
    ) -> RetrievalRouterResult:
        base_result = self._run_chroma_path(
            user_message, tenant_id, clinic_id, branch_id, intent, pipeline
        )
        return RetrievalRouterResult(
            success=True,
            mode="hybrid",
            intent=intent,
            pipeline=pipeline,
            results=base_result.results,
            source="chroma+future",
            fallback_used=False,
        )

    def _fallback_to_safe_mode(
        self,
        user_message: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str],
        intent: str,
        pipeline: str,
        error: str,
    ) -> RetrievalRouterResult:
        try:
            safe_result = self._run_chroma_path(
                user_message, tenant_id, clinic_id, branch_id, intent, pipeline
            )
            safe_result.fallback_used = True
            safe_result.error = error
            return safe_result
        except Exception as fallback_error:
            return RetrievalRouterResult(
                success=False,
                mode="fallback_failed",
                intent=intent,
                pipeline=pipeline,
                results={},
                source="none",
                fallback_used=True,
                error=f"{error} | fallback_error: {fallback_error}",
            )


def create_retrieval_router(retrieval_service: RetrievalService, mode: str = DEFAULT_MODE) -> RetrievalRouter:
    return RetrievalRouter(retrieval_service=retrieval_service, mode=mode)


def validate_retrieval_router(router: RetrievalRouter) -> Dict[str, Any]:
    errors = []
    if not isinstance(router.retrieval_service, RetrievalService):
        errors.append("retrieval_service must be RetrievalService")
    if router.mode not in ["chroma_only", "hybrid"]:
        errors.append("invalid mode")
    return {"valid": len(errors) == 0, "errors": errors}
