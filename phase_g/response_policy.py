from __future__ import annotations

import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional


GENERIC_BAD_PATTERNS = [
    "มีหลายแบบค่ะ",
    "มีหลายแบรนด์ค่ะ",
    "มีหลายยี่ห้อค่ะ",
    "มีหลายแบบครับ",
    "มีหลายแบรนด์ครับ",
    "มีหลายยี่ห้อครับ",
    "แล้วสนใจอะไรเป็นพิเศษไหม",
    "สนใจอะไรเป็นพิเศษไหมคะ",
    "สนใจอะไรเป็นพิเศษไหมครับ",
]

QUESTION_ENDINGS = ["?", "ครับ?", "คะ?", "ไหม", "ไหมคะ", "ไหมครับ", "หรือเปล่า", "หรือเปล่าคะ", "หรือเปล่าครับ"]


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    text = re.sub(r"\s+", " ", text)
    return text


def _normalize_text_lower(value: Any) -> str:
    return _normalize_text(value).lower()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _contains_any(text: str, patterns: List[str]) -> bool:
    lowered = _normalize_text_lower(text)
    return any(_normalize_text_lower(p) in lowered for p in patterns)


def _count_questions(text: str) -> int:
    normalized = _normalize_text(text)
    if not normalized:
        return 0
    count = normalized.count("?")
    lowered = normalized.lower()
    extra_hits = 0
    for ending in QUESTION_ENDINGS:
        extra_hits += lowered.count(ending)
    if count > 0:
        return count
    return extra_hits


def _contains_price_signal(text: str) -> bool:
    lowered = _normalize_text_lower(text)
    return any(s in lowered for s in ["บาท", "ราคา", "เริ่มต้น", "price"])


@dataclass
class ResponsePolicyConfig:
    answer_first: bool = True
    no_generic_answer: bool = True
    must_list_brands_if_available: bool = True
    must_answer_price_if_available: bool = True
    max_followup_questions: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ResponsePolicyEvaluation:
    passed: bool
    violations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checks: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ResponsePolicyEngine:
    def __init__(self, config: Optional[ResponsePolicyConfig] = None) -> None:
        self.config = config or ResponsePolicyConfig()

    def evaluate_response(
        self,
        user_message: str,
        response_text: str,
        built_context: Dict[str, Any],
        intent: str,
    ) -> ResponsePolicyEvaluation:
        response_text = _normalize_text(response_text)
        built_context = _safe_dict(built_context)
        normalized_intent = _normalize_text_lower(intent)

        violations: List[str] = []
        warnings: List[str] = []
        checks: Dict[str, Any] = {}

        clinic_brands = [_normalize_text(x) for x in _safe_list(built_context.get("clinic_brands")) if _normalize_text(x)]
        global_brands = [_normalize_text(x) for x in _safe_list(built_context.get("global_brands")) if _normalize_text(x)]
        all_brands = clinic_brands + [x for x in global_brands if x not in clinic_brands]
        price_ranges = [_normalize_text(x) for x in _safe_list(built_context.get("price_ranges")) if _normalize_text(x)]

        checks["response_non_empty"] = bool(response_text)
        if not response_text:
            violations.append("response_empty")

        is_generic = _contains_any(response_text, GENERIC_BAD_PATTERNS)
        checks["generic_answer_detected"] = is_generic
        if self.config.no_generic_answer and is_generic:
            violations.append("generic_answer_detected")

        expected_brand_answer = (
            self.config.must_list_brands_if_available
            and len(all_brands) > 0
            and normalized_intent in {"brand_inquiry", "recommendation", "discovery"}
        )
        brand_hits = [b for b in all_brands if _normalize_text_lower(b) in _normalize_text_lower(response_text)]
        checks["expected_brand_answer"] = expected_brand_answer
        checks["brands_available"] = all_brands
        checks["brand_hits"] = brand_hits
        if expected_brand_answer and len(brand_hits) == 0:
            violations.append("brand_list_missing")

        expected_price_answer = (
            self.config.must_answer_price_if_available
            and len(price_ranges) > 0
            and normalized_intent in {"pricing", "brand_inquiry", "recommendation"}
        )
        price_answered = _contains_price_signal(response_text)
        checks["expected_price_answer"] = expected_price_answer
        checks["price_ranges_available"] = price_ranges
        checks["price_answered"] = price_answered
        if expected_price_answer and not price_answered:
            violations.append("price_answer_missing")

        starts_with_question = _count_questions(response_text[:80]) > 0
        checks["starts_with_question"] = starts_with_question
        if self.config.answer_first and starts_with_question:
            warnings.append("response_may_not_be_answer_first")

        question_count = _count_questions(response_text)
        checks["question_count"] = question_count
        checks["max_followup_questions"] = self.config.max_followup_questions
        if question_count > self.config.max_followup_questions:
            violations.append("too_many_followup_questions")

        normalized_user = _normalize_text_lower(user_message)
        if ("ยี่ห้อ" in normalized_user or "brand" in normalized_user) and len(all_brands) > 0:
            if len(brand_hits) == 0:
                violations.append("user_asked_brand_but_response_missing_brand")
        if ("ราคา" in normalized_user or "เท่าไหร่" in normalized_user) and len(price_ranges) > 0:
            if not price_answered:
                violations.append("user_asked_price_but_response_missing_price")

        return ResponsePolicyEvaluation(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings,
            checks=checks,
        )

    def build_regeneration_instructions(
        self,
        evaluation: ResponsePolicyEvaluation,
        built_context: Dict[str, Any],
        intent: str,
    ) -> str:
        built_context = _safe_dict(built_context)
        intent = _normalize_text_lower(intent)
        clinic_brands = _safe_list(built_context.get("clinic_brands"))
        global_brands = _safe_list(built_context.get("global_brands"))
        price_ranges = _safe_list(built_context.get("price_ranges"))

        instructions: List[str] = [
            "แก้คำตอบใหม่โดยทำตามกฎต่อไปนี้:",
            "1. ตอบคำถามของลูกค้าให้ตรงก่อน",
            "2. ห้ามตอบ generic",
            "3. ใช้ข้อมูลจาก context เท่านั้น",
            "4. ถามต่อได้ไม่เกิน 1 คำถาม",
        ]

        if "brand_list_missing" in evaluation.violations or "user_asked_brand_but_response_missing_brand" in evaluation.violations:
            all_brands = clinic_brands + [x for x in global_brands if x not in clinic_brands]
            if all_brands:
                instructions.append("5. ต้องระบุชื่อแบรนด์ที่มีในข้อมูล เช่น: " + ", ".join(str(x) for x in all_brands))

        if "price_answer_missing" in evaluation.violations or "user_asked_price_but_response_missing_price" in evaluation.violations:
            if price_ranges:
                instructions.append("6. ต้องตอบราคา/ช่วงราคา เช่น: " + ", ".join(str(x) for x in price_ranges))

        if "too_many_followup_questions" in evaluation.violations:
            instructions.append("7. ห้ามถามมากกว่า 1 คำถาม")

        instructions.append(f"intent ปัจจุบันคือ: {intent}")
        return "\n".join(instructions)


_default_engine = ResponsePolicyEngine()


def evaluate_response_policy(
    user_message: str,
    response_text: str,
    built_context: Dict[str, Any],
    intent: str,
) -> Dict[str, Any]:
    result = _default_engine.evaluate_response(
        user_message=user_message,
        response_text=response_text,
        built_context=built_context,
        intent=intent,
    )
    return result.to_dict()


def build_regeneration_instructions(
    evaluation: Dict[str, Any],
    built_context: Dict[str, Any],
    intent: str,
) -> str:
    eval_model = ResponsePolicyEvaluation(
        passed=bool(evaluation.get("passed")),
        violations=_safe_list(evaluation.get("violations")),
        warnings=_safe_list(evaluation.get("warnings")),
        checks=_safe_dict(evaluation.get("checks")),
    )
    return _default_engine.build_regeneration_instructions(
        evaluation=eval_model,
        built_context=built_context,
        intent=intent,
    )
