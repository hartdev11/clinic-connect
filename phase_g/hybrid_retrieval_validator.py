from __future__ import annotations

from typing import Any, Dict, List, Optional

from brain_router import route_intent
from context_builder import build_context, render_prompt_context
from intent_classifier import classify_intent
from prompt_v4 import build_prompt_package
from response_policy import evaluate_response_policy
from retrieval_router import create_retrieval_router
from retrieval_telemetry_logger import (
    log_retrieval_telemetry,
    summarize_retrieval_telemetry,
)


def _ok(step: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"step": step, "success": True, "details": details or {}}


def _fail(step: str, error: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {"step": step, "success": False, "error": error, "details": details or {}}


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


class HybridRetrievalValidator:
    """
    End-to-end validator for upgraded retrieval+response stack.
    """

    def __init__(self, retrieval_service) -> None:
        self.retrieval_service = retrieval_service
        self.router = create_retrieval_router(retrieval_service)

    def validate_intent_classifier(self) -> Dict[str, Any]:
        try:
            cases = {
                "อยากทำปากครับ": "discovery",
                "มียี่ห้ออะไรบ้างครับ": "brand_inquiry",
                "ราคาเท่าไหร่ครับ": "pricing",
                "แบบไหนเหมาะกับผมครับ": "recommendation",
            }
            results = {}
            for msg, expected in cases.items():
                result = classify_intent(msg)
                results[msg] = result
                if result["intent"] != expected:
                    return _fail(
                        "intent_classifier",
                        f"expected {expected} but got {result['intent']}",
                        {"results": results},
                    )
            return _ok("intent_classifier", {"results": results})
        except Exception as e:
            return _fail("intent_classifier", str(e))

    def validate_brain_router(self) -> Dict[str, Any]:
        try:
            mapping = {
                "brand_inquiry": "product_pipeline",
                "pricing": "product_pipeline",
                "recommendation": "recommendation_pipeline",
                "discovery": "discovery_pipeline",
            }
            results = {}
            for intent, expected_pipeline in mapping.items():
                result = route_intent(intent)
                results[intent] = result
                if result["pipeline"] != expected_pipeline:
                    return _fail(
                        "brain_router",
                        f"intent {intent} expected pipeline {expected_pipeline} but got {result['pipeline']}",
                        {"results": results},
                    )
            return _ok("brain_router", {"results": results})
        except Exception as e:
            return _fail("brain_router", str(e))

    def validate_runtime_retrieval(self) -> Dict[str, Any]:
        try:
            intent_result = classify_intent("มียี่ห้ออะไรบ้างครับ")
            routing_result = route_intent(intent_result["intent"])
            router_result = self.router.route(
                user_message="มียี่ห้ออะไรบ้างครับ",
                tenant_id="t_001",
                clinic_id="c_001",
                branch_id=None,
                intent=intent_result["intent"],
                pipeline=routing_result["pipeline"],
            )
            payload = router_result.to_dict() if hasattr(router_result, "to_dict") else _safe_dict(router_result)
            if not payload.get("success"):
                return _fail("runtime_retrieval", "retrieval router returned unsuccessful result", payload)
            results = _safe_dict(payload.get("results"))
            merged = _safe_list(results.get("merged_results"))
            if not isinstance(merged, list):
                return _fail("runtime_retrieval", "merged_results missing or invalid", payload)
            return _ok(
                "runtime_retrieval",
                {
                    "mode": payload.get("mode"),
                    "source": payload.get("source"),
                    "merged_count": len(merged),
                    "results": payload,
                },
            )
        except Exception as e:
            return _fail("runtime_retrieval", str(e))

    def validate_context_builder(self) -> Dict[str, Any]:
        try:
            intent_result = classify_intent("มียี่ห้ออะไรบ้างครับ")
            routing_result = route_intent(intent_result["intent"])
            router_result = self.router.route(
                user_message="มียี่ห้ออะไรบ้างครับ",
                tenant_id="t_001",
                clinic_id="c_001",
                branch_id=None,
                intent=intent_result["intent"],
                pipeline=routing_result["pipeline"],
            )
            router_payload = router_result.to_dict() if hasattr(router_result, "to_dict") else _safe_dict(router_result)
            retrieval_payload = _safe_dict(router_payload.get("results"))
            merged_results = _safe_list(retrieval_payload.get("merged_results"))

            built_context = build_context(
                intent=intent_result["intent"],
                routing_result=routing_result,
                retrieval_results=merged_results,
                similar_conversations=["ลูกค้าถามยี่ห้อ ให้ตอบชื่อแบรนด์ก่อน แล้วค่อยถามลุคที่ต้องการ"],
            )
            rendered = render_prompt_context(built_context)
            if not rendered.strip():
                return _fail("context_builder", "rendered prompt context is empty", {"built_context": built_context})
            return _ok(
                "context_builder",
                {"built_context": built_context, "rendered_prompt_context": rendered},
            )
        except Exception as e:
            return _fail("context_builder", str(e))

    def validate_prompt_v4(self) -> Dict[str, Any]:
        try:
            intent_result = classify_intent("ราคาเท่าไหร่ครับ")
            routing_result = route_intent(intent_result["intent"])
            router_result = self.router.route(
                user_message="ราคาเท่าไหร่ครับ",
                tenant_id="t_001",
                clinic_id="c_001",
                branch_id=None,
                intent=intent_result["intent"],
                pipeline=routing_result["pipeline"],
            )
            router_payload = router_result.to_dict() if hasattr(router_result, "to_dict") else _safe_dict(router_result)
            retrieval_payload = _safe_dict(router_payload.get("results"))
            built_context = build_context(
                intent=intent_result["intent"],
                routing_result=routing_result,
                retrieval_results=_safe_list(retrieval_payload.get("merged_results")),
                similar_conversations=[],
            )
            prompt_package = build_prompt_package(
                user_message="ราคาเท่าไหร่ครับ",
                built_context=built_context,
                response_policy={
                    "answer_first": True,
                    "no_generic_answer": True,
                    "must_list_brands_if_available": True,
                    "must_answer_price_if_available": True,
                    "max_followup_questions": 1,
                },
            )
            final_prompt = prompt_package.get("final_prompt_text", "")
            if not final_prompt.strip():
                return _fail("prompt_v4", "final prompt is empty", {"prompt_package": prompt_package})
            return _ok("prompt_v4", {"prompt_package": prompt_package})
        except Exception as e:
            return _fail("prompt_v4", str(e))

    def validate_response_policy(self) -> Dict[str, Any]:
        try:
            built_context = {
                "intent": "brand_inquiry",
                "pipeline": "product_pipeline",
                "response_mode": "answer_first",
                "clinic_brands": ["Juvederm", "Restylane"],
                "global_brands": ["Belotero"],
                "price_ranges": ["7,999 บาท"],
            }
            bad_response = "มีหลายแบรนด์ค่ะ สนใจอะไรเป็นพิเศษไหมคะ"
            eval_bad = evaluate_response_policy(
                user_message="มียี่ห้ออะไรบ้างครับ",
                response_text=bad_response,
                built_context=built_context,
                intent="brand_inquiry",
            )
            if eval_bad["passed"]:
                return _fail(
                    "response_policy",
                    "bad response unexpectedly passed policy",
                    {"evaluation": eval_bad},
                )

            good_response = (
                "ตอนนี้ทางคลินิกมี Juvederm, Restylane และ Belotero ค่ะ "
                "ราคาเริ่มต้นประมาณ 7,999 บาทค่ะ "
                "ถ้าคุณอยากได้ลุคธรรมชาติหรือทรงชัด เดี๋ยวช่วยแนะนำให้เหมาะได้ค่ะ"
            )
            eval_good = evaluate_response_policy(
                user_message="มียี่ห้ออะไรบ้างครับ",
                response_text=good_response,
                built_context=built_context,
                intent="brand_inquiry",
            )
            if not eval_good["passed"]:
                return _fail(
                    "response_policy",
                    "good response unexpectedly failed policy",
                    {"evaluation": eval_good},
                )

            return _ok(
                "response_policy",
                {"bad_response_eval": eval_bad, "good_response_eval": eval_good},
            )
        except Exception as e:
            return _fail("response_policy", str(e))

    def validate_telemetry(self) -> Dict[str, Any]:
        try:
            intent_result = classify_intent("มียี่ห้ออะไรบ้างครับ")
            routing_result = route_intent(intent_result["intent"])
            router_result = self.router.route(
                user_message="มียี่ห้ออะไรบ้างครับ",
                tenant_id="t_001",
                clinic_id="c_001",
                branch_id=None,
                intent=intent_result["intent"],
                pipeline=routing_result["pipeline"],
            )
            router_payload = router_result.to_dict() if hasattr(router_result, "to_dict") else _safe_dict(router_result)
            policy_eval = {"passed": True, "violations": []}

            log_record = log_retrieval_telemetry(
                query="มียี่ห้ออะไรบ้างครับ",
                intent=intent_result["intent"],
                pipeline=routing_result["pipeline"],
                tenant_id="t_001",
                clinic_id="c_001",
                branch_id=None,
                router_result=router_payload,
                response_policy_evaluation=policy_eval,
                metadata={"validator": True},
            )
            summary = summarize_retrieval_telemetry(tenant_id="t_001", clinic_id="c_001")
            if summary["total_logs"] <= 0:
                return _fail("telemetry", "telemetry summary has no logs", {"summary": summary})
            return _ok("telemetry", {"log_record": log_record, "summary": summary})
        except Exception as e:
            return _fail("telemetry", str(e))

    def run_all(self) -> Dict[str, Any]:
        steps = [
            self.validate_intent_classifier(),
            self.validate_brain_router(),
            self.validate_runtime_retrieval(),
            self.validate_context_builder(),
            self.validate_prompt_v4(),
            self.validate_response_policy(),
            self.validate_telemetry(),
        ]
        success = all(step["success"] for step in steps)
        return {
            "success": success,
            "steps": steps,
            "summary": {
                "total_steps": len(steps),
                "passed": sum(1 for s in steps if s["success"]),
                "failed": sum(1 for s in steps if not s["success"]),
            },
        }


def validate_hybrid_retrieval_stack(retrieval_service) -> Dict[str, Any]:
    validator = HybridRetrievalValidator(retrieval_service=retrieval_service)
    return validator.run_all()


if __name__ == "__main__":
    from embedding_service import EmbeddingService
    from retrieval_service import RetrievalService
    from vector_store_interface import InMemoryVectorRecord, InMemoryVectorStore

    emb = EmbeddingService()
    records = [
        InMemoryVectorRecord(
            id="c1",
            text="คลินิกมี Juvederm และ Restylane ราคาเริ่มต้น 7,999 บาท",
            embedding=emb.embed_text("คลินิกมี Juvederm และ Restylane ราคาเริ่มต้น 7,999 บาท").embedding,
            metadata={
                "scope": "clinic",
                "tenant_id": "t_001",
                "clinic_id": "c_001",
                "is_active": True,
                "source_type": "clinic_knowledge",
            },
        ),
        InMemoryVectorRecord(
            id="g1",
            text="Belotero เป็นอีกตัวเลือกสำหรับเติมปาก",
            embedding=emb.embed_text("Belotero เป็นอีกตัวเลือกสำหรับเติมปาก").embedding,
            metadata={
                "scope": "global",
                "is_active": True,
                "source_type": "procedure_knowledge",
            },
        ),
    ]
    svc = RetrievalService(emb, InMemoryVectorStore(records))
    out = validate_hybrid_retrieval_stack(svc)
    print(out)
    if out.get("success"):
        print("FINAL RESULT: PASS")
    else:
        print("FINAL RESULT: FAIL")
