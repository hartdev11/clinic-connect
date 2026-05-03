from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional


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


def _dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    output: List[str] = []
    for item in items:
        normalized = _normalize_text(item)
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        output.append(normalized)
    return output


DEFAULT_CTA_BY_INTENT: Dict[str, str] = {
    "brand_inquiry": "ask_preference",
    "pricing": "qualify_budget",
    "recommendation": "ask_goal",
    "discovery": "guide_next_step",
    "booking": "offer_booking",
    "promotion": "offer_booking",
    "comparison": "ask_preference",
    "objection": "reduce_friction",
    "safety": "offer_doctor_consult",
    "doctor_inquiry": "offer_doctor_match",
    "location_hours": "offer_booking",
    "general": "guide_next_step",
}

DEFAULT_CONFIDENCE = 0.70


@dataclass
class RecommendationOption:
    label: str
    reason: str
    source: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DecisionPacket:
    intent: str
    pipeline: str
    primary_answer_type: str
    response_strategy: str
    brands_to_mention: List[str] = field(default_factory=list)
    price_ranges_to_mention: List[str] = field(default_factory=list)
    recommendation_options: List[RecommendationOption] = field(default_factory=list)
    primary_recommendation: Optional[str] = None
    primary_reason: Optional[str] = None
    cta_type: str = "guide_next_step"
    cta_message_hint: Optional[str] = None
    confidence: float = DEFAULT_CONFIDENCE
    evidence_blocks: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    reasoning: str = ""

    def to_dict(self) -> Dict[str, Any]:
        payload = asdict(self)
        payload["recommendation_options"] = [x.to_dict() for x in self.recommendation_options]
        return payload

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not self.intent:
            errors.append("intent is required")
        if not self.pipeline:
            errors.append("pipeline is required")
        if not self.primary_answer_type:
            errors.append("primary_answer_type is required")
        if not self.response_strategy:
            errors.append("response_strategy is required")
        if not (0.0 <= self.confidence <= 1.0):
            errors.append("confidence must be between 0 and 1")
        return {"valid": len(errors) == 0, "errors": errors}


class DecisionEngine:
    def decide(
        self,
        intent: str,
        built_context: Dict[str, Any],
        user_message: Optional[str] = None,
    ) -> DecisionPacket:
        ctx = _safe_dict(built_context)
        normalized_intent = _normalize_text_lower(intent or ctx.get("intent") or "general")
        pipeline = _normalize_text_lower(ctx.get("pipeline") or "general_pipeline")

        clinic_brands = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("clinic_brands"))])
        global_brands = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("global_brands"))])
        price_ranges = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("price_ranges"))])
        procedure_summary = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("procedure_summary"))])
        recommendation_hints = _dedupe_keep_order(
            [_normalize_text(x) for x in _safe_list(ctx.get("recommendation_hints"))]
        )

        brands_to_mention = clinic_brands[:] if clinic_brands else global_brands[:]
        evidence_blocks: List[str] = []
        warnings: List[str] = []

        if brands_to_mention:
            evidence_blocks.append("brands: " + ", ".join(brands_to_mention[:5]))
        if price_ranges:
            evidence_blocks.append("prices: " + ", ".join(price_ranges[:3]))
        evidence_blocks.extend(procedure_summary[:3])
        evidence_blocks.extend(recommendation_hints[:2])

        cta_type = DEFAULT_CTA_BY_INTENT.get(normalized_intent, "guide_next_step")
        primary_answer_type = self._resolve_primary_answer_type(normalized_intent)
        response_strategy = self._resolve_response_strategy(normalized_intent)

        recommendation_options = self._build_recommendation_options(
            intent=normalized_intent,
            recommendation_hints=recommendation_hints,
            procedure_summary=procedure_summary,
            brands_to_mention=brands_to_mention,
            user_message=user_message or "",
        )

        primary_recommendation, primary_reason = self._pick_primary_recommendation(
            normalized_intent=normalized_intent,
            recommendation_options=recommendation_options,
            recommendation_hints=recommendation_hints,
            procedure_summary=procedure_summary,
            brands_to_mention=brands_to_mention,
        )

        cta_message_hint = self._build_cta_hint(intent=normalized_intent, cta_type=cta_type)

        confidence = self._estimate_confidence(
            brands_to_mention=brands_to_mention,
            price_ranges=price_ranges,
            recommendation_hints=recommendation_hints,
            evidence_blocks=evidence_blocks,
        )

        if normalized_intent == "brand_inquiry" and not brands_to_mention:
            warnings.append("brand_inquiry_without_brand_data")
        if normalized_intent == "pricing" and not price_ranges:
            warnings.append("pricing_intent_without_price_data")
        if normalized_intent in {"recommendation", "discovery"} and not recommendation_options and not recommendation_hints:
            warnings.append("recommendation_flow_without_recommendation_signal")

        reasoning = self._build_reasoning(
            intent=normalized_intent,
            pipeline=pipeline,
            primary_answer_type=primary_answer_type,
            brands_to_mention=brands_to_mention,
            price_ranges=price_ranges,
            recommendation_options=recommendation_options,
        )

        return DecisionPacket(
            intent=normalized_intent,
            pipeline=pipeline,
            primary_answer_type=primary_answer_type,
            response_strategy=response_strategy,
            brands_to_mention=brands_to_mention[:5],
            price_ranges_to_mention=price_ranges[:3],
            recommendation_options=recommendation_options[:3],
            primary_recommendation=primary_recommendation,
            primary_reason=primary_reason,
            cta_type=cta_type,
            cta_message_hint=cta_message_hint,
            confidence=confidence,
            evidence_blocks=evidence_blocks[:6],
            warnings=warnings,
            reasoning=reasoning,
        )

    def _resolve_primary_answer_type(self, intent: str) -> str:
        mapping = {
            "brand_inquiry": "brand_answer",
            "pricing": "price_answer",
            "recommendation": "recommendation_answer",
            "discovery": "discovery_answer",
            "booking": "booking_answer",
            "promotion": "promotion_answer",
            "comparison": "comparison_answer",
            "objection": "objection_answer",
            "safety": "safety_answer",
            "doctor_inquiry": "doctor_answer",
            "location_hours": "location_answer",
            "general": "general_answer",
        }
        return mapping.get(intent, "general_answer")

    def _resolve_response_strategy(self, intent: str) -> str:
        mapping = {
            "brand_inquiry": "answer_then_narrow_down",
            "pricing": "answer_then_qualify",
            "recommendation": "recommend_then_ask_goal",
            "discovery": "guide_and_narrow_down",
            "booking": "direct_booking_support",
            "promotion": "promo_then_convert",
            "comparison": "compare_then_recommend",
            "objection": "reduce_friction_then_convert",
            "safety": "reassure_with_facts",
            "doctor_inquiry": "build_trust",
            "location_hours": "operational_support",
            "general": "helpful_guidance",
        }
        return mapping.get(intent, "helpful_guidance")

    def _build_recommendation_options(
        self,
        intent: str,
        recommendation_hints: List[str],
        procedure_summary: List[str],
        brands_to_mention: List[str],
        user_message: str,
    ) -> List[RecommendationOption]:
        options: List[RecommendationOption] = []
        normalized_user = _normalize_text_lower(user_message)

        if "ธรรมชาติ" in normalized_user or any("ธรรมชาติ" in _normalize_text_lower(x) for x in recommendation_hints):
            options.append(
                RecommendationOption(
                    label="natural_look_option",
                    reason="ผู้ใช้สนใจลุคธรรมชาติ หรือ context มี hint เรื่องธรรมชาติ",
                    source="recommendation_hints",
                )
            )
        if "ทรงชัด" in normalized_user or "คมชัด" in normalized_user:
            options.append(
                RecommendationOption(
                    label="defined_shape_option",
                    reason="ผู้ใช้สนใจทรงชัด/คมชัด",
                    source="user_message",
                )
            )
        if "ปาก" in normalized_user or any("ปาก" in _normalize_text_lower(x) for x in procedure_summary):
            options.append(
                RecommendationOption(
                    label="lip_filler_option",
                    reason="context ชี้ไปที่บริการทำปาก/ฟิลเลอร์ปาก",
                    source="procedure_summary",
                )
            )
        if brands_to_mention:
            options.append(
                RecommendationOption(
                    label="brand_backed_option",
                    reason="มี brand data จริงใน context",
                    source="brand_data",
                )
            )
        return options

    def _pick_primary_recommendation(
        self,
        normalized_intent: str,
        recommendation_options: List[RecommendationOption],
        recommendation_hints: List[str],
        procedure_summary: List[str],
        brands_to_mention: List[str],
    ) -> tuple[Optional[str], Optional[str]]:
        if recommendation_options:
            first = recommendation_options[0]
            if first.label == "natural_look_option":
                return "recommend_natural_style", "context ชี้ว่าลูกค้าสนใจลุคธรรมชาติ"
            if first.label == "defined_shape_option":
                return "recommend_defined_shape", "context ชี้ว่าลูกค้าสนใจทรงชัด"
            if first.label == "lip_filler_option":
                return "recommend_lip_filler_consult", "context ชี้ว่าลูกค้าสนใจทำปาก"
            if first.label == "brand_backed_option":
                return "recommend_brand_guided_choice", "มี brand data จริงในระบบ"

        if normalized_intent == "brand_inquiry" and brands_to_mention:
            return "list_brands_then_ask_preference", "intent เป็น brand inquiry และมี brand list"
        if normalized_intent == "pricing" and procedure_summary:
            return "answer_price_then_estimate_budget", "intent เป็น pricing และมี procedure facts"
        if recommendation_hints:
            return "use_recommendation_hints", "มี recommendation hints ใน context"
        return None, None

    def _build_cta_hint(self, intent: str, cta_type: str) -> str:
        mapping = {
            "ask_preference": "ถามต่อว่าชอบลุคธรรมชาติหรือทรงชัด",
            "qualify_budget": "ถามต่อว่ามีทรงที่อยากได้หรือช่วงงบประมาณไหม",
            "ask_goal": "ถามต่อว่ากังวลตรงไหนหรืออยากได้ลุคแบบไหน",
            "guide_next_step": "ถามต่อเพื่อช่วยเลือกบริการที่เหมาะ",
            "offer_booking": "ชวนเช็กคิวหรือประเมินเบื้องต้น",
            "reduce_friction": "ลดความกังวลแล้วชวนปรึกษาต่อ",
            "offer_doctor_consult": "ชวนเข้ามาประเมินกับแพทย์",
            "offer_doctor_match": "ถามว่าต้องการนัดประเมินกับคุณหมอไหม",
        }
        return mapping.get(cta_type, "ถามต่อ 1 คำถามเพื่อพา conversation ไปข้างหน้า")

    def _estimate_confidence(
        self,
        brands_to_mention: List[str],
        price_ranges: List[str],
        recommendation_hints: List[str],
        evidence_blocks: List[str],
    ) -> float:
        score = 0.50
        if brands_to_mention:
            score += 0.15
        if price_ranges:
            score += 0.10
        if recommendation_hints:
            score += 0.10
        if len(evidence_blocks) >= 2:
            score += 0.10
        return round(min(score, 0.95), 2)

    def _build_reasoning(
        self,
        intent: str,
        pipeline: str,
        primary_answer_type: str,
        brands_to_mention: List[str],
        price_ranges: List[str],
        recommendation_options: List[RecommendationOption],
    ) -> str:
        parts = [
            f"intent={intent}",
            f"pipeline={pipeline}",
            f"answer_type={primary_answer_type}",
            f"brands={len(brands_to_mention)}",
            f"prices={len(price_ranges)}",
            f"recommendation_options={len(recommendation_options)}",
        ]
        return " | ".join(parts)


_default_engine = DecisionEngine()


def decide_response_plan(
    intent: str,
    built_context: Dict[str, Any],
    user_message: Optional[str] = None,
) -> Dict[str, Any]:
    result = _default_engine.decide(
        intent=intent,
        built_context=built_context,
        user_message=user_message,
    )
    return result.to_dict()


if __name__ == "__main__":
    sample_context = {
        "intent": "brand_inquiry",
        "pipeline": "product_pipeline",
        "clinic_brands": ["Juvederm", "Restylane"],
        "global_brands": ["Belotero"],
        "price_ranges": ["7,999 บาท"],
        "procedure_summary": ["ฟิลเลอร์ปากใช้เพื่อเพิ่ม volume และปรับทรงปาก"],
        "recommendation_hints": ["ถ้าอยากได้ลุคธรรมชาติ แนะนำรุ่นเนื้อนิ่ม"],
        "final_context_blocks": [
            "Clinic brands: Juvederm, Restylane",
            "Price ranges: 7,999 บาท",
        ],
    }

    result = decide_response_plan(
        intent="brand_inquiry",
        built_context=sample_context,
        user_message="มียี่ห้ออะไรบ้างครับ",
    )
    print("=== DECISION ENGINE TEST ===")
    print(result)
