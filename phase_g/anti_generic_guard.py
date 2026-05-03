from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List


GENERIC_PATTERNS = [
    "ขึ้นอยู่กับแต่ละคน",
    "ขึ้นอยู่กับแต่ละบุคคล",
    "มีหลายแบบค่ะ",
    "มีหลายแบบครับ",
    "มีหลายแบรนด์ค่ะ",
    "มีหลายแบรนด์ครับ",
    "มีหลายยี่ห้อค่ะ",
    "มีหลายยี่ห้อครับ",
    "สามารถสอบถามเพิ่มเติมได้",
    "สามารถสอบถามเพิ่มเติมได้ค่ะ",
    "สามารถสอบถามเพิ่มเติมได้ครับ",
    "สนใจอะไรเป็นพิเศษไหม",
    "สนใจแบบไหนเป็นพิเศษไหม",
    "แล้วสนใจอะไรเป็นพิเศษไหม",
    "แล้วสนใจแบบไหนเป็นพิเศษไหม",
]

WEAK_PATTERNS = ["โดยทั่วไป", "ส่วนใหญ่", "มักจะ", "อาจจะ", "ประมาณ"]

QUESTION_TOKENS = ["?", "ไหม", "ไหมคะ", "ไหมครับ", "หรือเปล่า", "หรือเปล่าคะ", "หรือเปล่าครับ"]

MAX_ALLOWED_GENERIC_HITS = 0
MAX_ALLOWED_QUESTION_COUNT = 1


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


def _count_pattern_hits(text: str, patterns: List[str]) -> List[str]:
    lowered = _normalize_text_lower(text)
    hits: List[str] = []
    for pattern in patterns:
        if _normalize_text_lower(pattern) in lowered:
            hits.append(pattern)
    return hits


def _count_questions(text: str) -> int:
    normalized = _normalize_text(text)
    if not normalized:
        return 0
    if "?" in normalized:
        return normalized.count("?")
    lowered = normalized.lower()
    count = 0
    for token in QUESTION_TOKENS:
        count += lowered.count(token)
    return count


@dataclass
class AntiGenericGuardResult:
    passed: bool
    action: str
    reasons: List[str] = field(default_factory=list)
    generic_hits: List[str] = field(default_factory=list)
    weak_hits: List[str] = field(default_factory=list)
    missing_fact_flags: List[str] = field(default_factory=list)
    checks: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AntiGenericGuard:
    def evaluate(
        self,
        user_message: str,
        response_text: str,
        hard_context: Dict[str, Any],
        decision_packet: Dict[str, Any],
        intent: str,
    ) -> AntiGenericGuardResult:
        user_message = _normalize_text(user_message)
        response_text = _normalize_text(response_text)
        hard_context = _safe_dict(hard_context)
        decision_packet = _safe_dict(decision_packet)
        intent = _normalize_text_lower(intent)

        reasons: List[str] = []
        missing_fact_flags: List[str] = []
        checks: Dict[str, Any] = {}

        generic_hits = _count_pattern_hits(response_text, GENERIC_PATTERNS)
        weak_hits = _count_pattern_hits(response_text, WEAK_PATTERNS)

        allowed_brands = [_normalize_text(x) for x in _safe_list(hard_context.get("allowed_brands")) if _normalize_text(x)]
        allowed_prices = [_normalize_text(x) for x in _safe_list(hard_context.get("allowed_prices")) if _normalize_text(x)]
        recommended_items = [
            _normalize_text(x) for x in _safe_list(hard_context.get("recommended_items")) if _normalize_text(x)
        ]

        lowered_response = _normalize_text_lower(response_text)
        lowered_user = _normalize_text_lower(user_message)

        checks["generic_hits"] = generic_hits
        if len(generic_hits) > MAX_ALLOWED_GENERIC_HITS:
            reasons.append("generic_phrase_detected")

        question_count = _count_questions(response_text)
        checks["question_count"] = question_count
        if question_count > MAX_ALLOWED_QUESTION_COUNT:
            reasons.append("too_many_questions")

        if intent == "brand_inquiry" and allowed_brands:
            brand_hits = [b for b in allowed_brands if _normalize_text_lower(b) in lowered_response]
            checks["brand_hits"] = brand_hits
            if len(brand_hits) == 0:
                reasons.append("brand_not_used")
                missing_fact_flags.append("missing_brand_fact")

        if intent in {"pricing", "brand_inquiry"} and allowed_prices:
            price_hits = [p for p in allowed_prices if _normalize_text_lower(p) in lowered_response]
            checks["price_hits"] = price_hits
            if len(price_hits) == 0 and not any(token in lowered_response for token in ["บาท", "ราคา", "เริ่มต้น"]):
                reasons.append("price_not_used")
                missing_fact_flags.append("missing_price_fact")

        if intent in {"recommendation", "discovery"} and recommended_items:
            recommendation_hits = [r for r in recommended_items if _normalize_text_lower(r) in lowered_response]
            checks["recommendation_hits"] = recommendation_hits
            if len(recommendation_hits) == 0:
                reasons.append("recommendation_not_used")
                missing_fact_flags.append("missing_recommendation_fact")

        if "ยี่ห้อ" in lowered_user and allowed_brands:
            if not checks.get("brand_hits"):
                reasons.append("direct_brand_question_dodged")

        if ("ราคา" in lowered_user or "เท่าไหร่" in lowered_user) and allowed_prices:
            price_hits = checks.get("price_hits", [])
            if not price_hits and not any(token in lowered_response for token in ["บาท", "ราคา", "เริ่มต้น"]):
                reasons.append("direct_price_question_dodged")

        if not response_text:
            return AntiGenericGuardResult(
                passed=False,
                action="reject",
                reasons=["empty_response"],
                generic_hits=generic_hits,
                weak_hits=weak_hits,
                missing_fact_flags=missing_fact_flags,
                checks=checks,
            )

        if reasons:
            return AntiGenericGuardResult(
                passed=False,
                action="regenerate",
                reasons=reasons,
                generic_hits=generic_hits,
                weak_hits=weak_hits,
                missing_fact_flags=missing_fact_flags,
                checks=checks,
            )

        return AntiGenericGuardResult(
            passed=True,
            action="pass",
            reasons=[],
            generic_hits=generic_hits,
            weak_hits=weak_hits,
            missing_fact_flags=missing_fact_flags,
            checks=checks,
        )

    def build_regeneration_instruction(
        self,
        guard_result: AntiGenericGuardResult,
        hard_context: Dict[str, Any],
        decision_packet: Dict[str, Any],
        intent: str,
    ) -> str:
        hard_context = _safe_dict(hard_context)
        decision_packet = _safe_dict(decision_packet)
        intent = _normalize_text_lower(intent)

        allowed_brands = _safe_list(hard_context.get("allowed_brands"))
        allowed_prices = _safe_list(hard_context.get("allowed_prices"))
        recommended_items = _safe_list(hard_context.get("recommended_items"))

        lines: List[str] = [
            "สร้างคำตอบใหม่โดยทำตามข้อบังคับต่อไปนี้:",
            "1. ห้ามใช้คำตอบ generic หรือเลี่ยงคำถาม",
            "2. ต้องตอบคำถามหลักก่อน",
            "3. ต้องใช้ข้อมูลจาก HARD CONTEXT และ DECISION PACKET เท่านั้น",
            "4. ถามต่อได้ไม่เกิน 1 คำถาม",
        ]

        if "brand_not_used" in guard_result.reasons or "direct_brand_question_dodged" in guard_result.reasons:
            if allowed_brands:
                lines.append("5. ต้องระบุชื่อแบรนด์อย่างน้อย 1 รายการจาก: " + ", ".join(str(x) for x in allowed_brands))

        if "price_not_used" in guard_result.reasons or "direct_price_question_dodged" in guard_result.reasons:
            if allowed_prices:
                lines.append("6. ต้องตอบราคา/ช่วงราคาจาก: " + ", ".join(str(x) for x in allowed_prices))

        if "recommendation_not_used" in guard_result.reasons and recommended_items:
            lines.append("7. ต้องใช้ recommendation หรือเหตุผลจาก: " + ", ".join(str(x) for x in recommended_items))

        if guard_result.generic_hits:
            lines.append("8. ห้ามใช้ประโยคเหล่านี้อีก: " + ", ".join(guard_result.generic_hits))

        primary_recommendation = _normalize_text(decision_packet.get("primary_recommendation"))
        primary_reason = _normalize_text(decision_packet.get("primary_reason"))
        cta_hint = _normalize_text(decision_packet.get("cta_message_hint"))

        if primary_recommendation:
            lines.append(f"9. primary recommendation ที่ต้องยึด: {primary_recommendation}")
        if primary_reason:
            lines.append(f"10. เหตุผลหลักที่ต้องใช้: {primary_reason}")
        if cta_hint:
            lines.append(f"11. ปิดท้ายด้วยแนว CTA นี้: {cta_hint}")

        lines.append(f"intent ปัจจุบันคือ: {intent}")
        return "\n".join(lines)


_default_guard = AntiGenericGuard()


def evaluate_anti_generic_guard(
    user_message: str,
    response_text: str,
    hard_context: Dict[str, Any],
    decision_packet: Dict[str, Any],
    intent: str,
) -> Dict[str, Any]:
    result = _default_guard.evaluate(
        user_message=user_message,
        response_text=response_text,
        hard_context=hard_context,
        decision_packet=decision_packet,
        intent=intent,
    )
    return result.to_dict()


def build_anti_generic_regeneration_instruction(
    guard_result: Dict[str, Any],
    hard_context: Dict[str, Any],
    decision_packet: Dict[str, Any],
    intent: str,
) -> str:
    model = AntiGenericGuardResult(
        passed=bool(guard_result.get("passed")),
        action=_normalize_text(guard_result.get("action")),
        reasons=_safe_list(guard_result.get("reasons")),
        generic_hits=_safe_list(guard_result.get("generic_hits")),
        weak_hits=_safe_list(guard_result.get("weak_hits")),
        missing_fact_flags=_safe_list(guard_result.get("missing_fact_flags")),
        checks=_safe_dict(guard_result.get("checks")),
    )
    return _default_guard.build_regeneration_instruction(
        guard_result=model,
        hard_context=hard_context,
        decision_packet=decision_packet,
        intent=intent,
    )
