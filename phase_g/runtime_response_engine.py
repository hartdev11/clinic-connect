from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

from brain_router import route_intent
from anti_generic_guard import (
    build_anti_generic_regeneration_instruction,
    evaluate_anti_generic_guard,
)
from context_builder import build_context
from decision_engine import decide_response_plan
from hard_context_builder import build_hard_context
from intent_classifier import classify_intent
from prompt_v4 import build_prompt_package
from response_policy import (
    build_regeneration_instructions,
    evaluate_response_policy,
)
from retrieval_router import RetrievalRouter
from retrieval_telemetry_logger import log_retrieval_telemetry


class LLMClientInterface:
    """
    Contract for project-specific LLM wrapper (OpenRouter/Qwen etc.).
    """

    def generate(
        self,
        system_prompt: str,
        developer_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        raise NotImplementedError


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


DEFAULT_TEMPERATURE = 0.4
MAX_REGEN_ATTEMPTS = 1


@dataclass
class RuntimeResponseResult:
    success: bool
    user_message: str
    intent_result: Dict[str, Any]
    routing_result: Dict[str, Any]
    retrieval_result: Dict[str, Any]
    built_context: Dict[str, Any]
    decision_packet: Dict[str, Any]
    hard_context: Dict[str, Any]
    prompt_package: Dict[str, Any]
    llm_response: Dict[str, Any]
    response_policy_evaluation: Dict[str, Any]
    anti_generic_guard_evaluation: Dict[str, Any]
    telemetry_record: Dict[str, Any]
    final_text: str
    regenerated: bool
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class RuntimeResponseEngine:
    def __init__(
        self,
        retrieval_router: RetrievalRouter,
        llm_client: LLMClientInterface,
        temperature: float = DEFAULT_TEMPERATURE,
        max_regen_attempts: int = MAX_REGEN_ATTEMPTS,
    ) -> None:
        self.retrieval_router = retrieval_router
        self.llm_client = llm_client
        self.temperature = temperature
        self.max_regen_attempts = max_regen_attempts

    def generate_response(
        self,
        user_message: str,
        tenant_id: str,
        clinic_id: Optional[str],
        branch_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        similar_conversations: Optional[List[str]] = None,
        clinic_facts: Optional[Dict[str, Any]] = None,
    ) -> RuntimeResponseResult:
        user_message = _normalize_text(user_message)
        if not user_message:
            raise ValueError("user_message is required")

        intent_result = classify_intent(user_message)
        intent = intent_result["intent"]

        routing_result = route_intent(intent)
        pipeline = routing_result["pipeline"]

        retrieval_result_obj = self.retrieval_router.route(
            user_message=user_message,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            intent=intent,
            pipeline=pipeline,
        )
        retrieval_result = (
            retrieval_result_obj.to_dict()
            if hasattr(retrieval_result_obj, "to_dict")
            else _safe_dict(retrieval_result_obj)
        )

        if not retrieval_result.get("success"):
            return RuntimeResponseResult(
                success=False,
                user_message=user_message,
                intent_result=intent_result,
                routing_result=routing_result,
                retrieval_result=retrieval_result,
                built_context={},
                decision_packet={},
                hard_context={},
                prompt_package={},
                llm_response={},
                response_policy_evaluation={},
                anti_generic_guard_evaluation={},
                telemetry_record={},
                final_text="",
                regenerated=False,
                error=retrieval_result.get("error") or "retrieval_failed",
            )

        merged_results = _safe_list(_safe_dict(retrieval_result.get("results")).get("merged_results"))

        built_context = build_context(
            intent=intent,
            routing_result=routing_result,
            retrieval_results=merged_results,
            similar_conversations=similar_conversations or [],
        )
        if clinic_facts:
            built_context["clinic_facts"] = _safe_dict(clinic_facts)

        decision_packet = decide_response_plan(
            intent=intent,
            built_context=built_context,
            user_message=user_message,
        )
        built_context["decision_packet"] = decision_packet
        hard_context = build_hard_context(
            built_context=built_context,
            decision_packet=decision_packet,
        )
        built_context["hard_context"] = hard_context
        rendered_hard_context = _normalize_text(hard_context.get("rendered_text"))
        if rendered_hard_context:
            existing_blocks = [
                _normalize_text(x) for x in _safe_list(built_context.get("final_context_blocks"))
            ]
            built_context["final_context_blocks"] = [
                "[HARD CONTEXT]\n" + rendered_hard_context
            ] + [x for x in existing_blocks if x]

        policy_config = {
            "answer_first": True,
            "no_generic_answer": True,
            "must_list_brands_if_available": True,
            "must_answer_price_if_available": True,
            "max_followup_questions": 1,
        }
        prompt_package = build_prompt_package(
            user_message=user_message,
            built_context=built_context,
            response_policy=policy_config,
        )

        llm_response = self.llm_client.generate(
            system_prompt=prompt_package["system_prompt"],
            developer_prompt=prompt_package["developer_prompt"],
            user_prompt="\n\n".join([prompt_package["context_text"], prompt_package["user_prompt"]]),
            temperature=self.temperature,
            metadata={
                "intent": intent,
                "pipeline": pipeline,
                "session_id": session_id,
                "user_id": user_id,
            },
        )

        if not llm_response.get("success"):
            telemetry_record = log_retrieval_telemetry(
                query=user_message,
                intent=intent,
                pipeline=pipeline,
                tenant_id=tenant_id,
                clinic_id=clinic_id,
                branch_id=branch_id,
                router_result=retrieval_result,
                response_policy_evaluation={"passed": False, "violations": ["llm_generation_failed"]},
                metadata={"session_id": session_id, "user_id": user_id},
            )
            return RuntimeResponseResult(
                success=False,
                user_message=user_message,
                intent_result=intent_result,
                routing_result=routing_result,
                retrieval_result=retrieval_result,
                built_context=built_context,
                decision_packet=decision_packet,
                hard_context=hard_context,
                prompt_package=prompt_package,
                llm_response=llm_response,
                response_policy_evaluation={"passed": False, "violations": ["llm_generation_failed"]},
                anti_generic_guard_evaluation={},
                telemetry_record=telemetry_record,
                final_text="",
                regenerated=False,
                error=llm_response.get("error") or "llm_generation_failed",
            )

        generated_text = _normalize_text(llm_response.get("text"))
        response_policy_evaluation = evaluate_response_policy(
            user_message=user_message,
            response_text=generated_text,
            built_context=built_context,
            intent=intent,
        )
        anti_generic_guard_evaluation = evaluate_anti_generic_guard(
            user_message=user_message,
            response_text=generated_text,
            hard_context=hard_context,
            decision_packet=decision_packet,
            intent=intent,
        )

        regenerated = False
        final_text = generated_text
        final_llm_response = llm_response

        if (not response_policy_evaluation.get("passed", False)) or (not anti_generic_guard_evaluation.get("passed", False)):
            regen_count = 0
            while regen_count < self.max_regen_attempts:
                regen_instruction = build_regeneration_instructions(
                    evaluation=response_policy_evaluation,
                    built_context=built_context,
                    intent=intent,
                )
                anti_generic_regen_instruction = build_anti_generic_regeneration_instruction(
                    guard_result=anti_generic_guard_evaluation,
                    hard_context=hard_context,
                    decision_packet=decision_packet,
                    intent=intent,
                )
                regen_prompt_package = build_prompt_package(
                    user_message=user_message,
                    built_context=built_context,
                    response_policy=policy_config,
                    extra_instructions=[regen_instruction, anti_generic_regen_instruction],
                )
                regen_llm_response = self.llm_client.generate(
                    system_prompt=regen_prompt_package["system_prompt"],
                    developer_prompt=regen_prompt_package["developer_prompt"],
                    user_prompt="\n\n".join([regen_prompt_package["context_text"], regen_prompt_package["user_prompt"]]),
                    temperature=self.temperature,
                    metadata={
                        "intent": intent,
                        "pipeline": pipeline,
                        "session_id": session_id,
                        "user_id": user_id,
                        "regenerated": True,
                    },
                )
                if regen_llm_response.get("success"):
                    regen_text = _normalize_text(regen_llm_response.get("text"))
                    regen_eval = evaluate_response_policy(
                        user_message=user_message,
                        response_text=regen_text,
                        built_context=built_context,
                        intent=intent,
                    )
                    regen_guard_eval = evaluate_anti_generic_guard(
                        user_message=user_message,
                        response_text=regen_text,
                        hard_context=hard_context,
                        decision_packet=decision_packet,
                        intent=intent,
                    )
                    if regen_eval.get("passed", False) and regen_guard_eval.get("passed", False):
                        regenerated = True
                        final_text = regen_text
                        final_llm_response = regen_llm_response
                        response_policy_evaluation = regen_eval
                        anti_generic_guard_evaluation = regen_guard_eval
                        prompt_package = regen_prompt_package
                        break
                regen_count += 1

        telemetry_record = log_retrieval_telemetry(
            query=user_message,
            intent=intent,
            pipeline=pipeline,
            tenant_id=tenant_id,
            clinic_id=clinic_id,
            branch_id=branch_id,
            router_result=retrieval_result,
            response_policy_evaluation=response_policy_evaluation,
            metadata={
                "session_id": session_id,
                "user_id": user_id,
                "regenerated": regenerated,
                "llm_model": final_llm_response.get("model"),
            },
        )

        return RuntimeResponseResult(
            success=True,
            user_message=user_message,
            intent_result=intent_result,
            routing_result=routing_result,
            retrieval_result=retrieval_result,
            built_context=built_context,
            decision_packet=decision_packet,
            hard_context=hard_context,
            prompt_package=prompt_package,
            llm_response=final_llm_response,
            response_policy_evaluation=response_policy_evaluation,
            anti_generic_guard_evaluation=anti_generic_guard_evaluation,
            telemetry_record=telemetry_record,
            final_text=final_text,
            regenerated=regenerated,
            error=None,
        )


class MockLLMClient(LLMClientInterface):
    def generate(
        self,
        system_prompt: str,
        developer_prompt: str,
        user_prompt: str,
        temperature: float = 0.4,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return {
            "success": True,
            "text": "ตอนนี้ทางคลินิกมี Juvederm, Restylane และ Belotero ค่ะ ราคาเริ่มต้นประมาณ 7,999 บาทค่ะ ถ้าคุณชอบลุคธรรมชาติหรือทรงชัด เดี๋ยวช่วยแนะนำให้เหมาะได้ค่ะ 😊",
            "model": "mock-llm",
            "usage": {},
            "error": None,
        }
