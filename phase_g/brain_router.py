from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List


SUPPORTED_PIPELINES = {
    "product_pipeline",
    "recommendation_pipeline",
    "discovery_pipeline",
    "booking_pipeline",
    "promotion_pipeline",
    "comparison_pipeline",
    "objection_pipeline",
    "safety_pipeline",
    "doctor_pipeline",
    "location_hours_pipeline",
    "general_pipeline",
}


INTENT_PIPELINE_MAP: Dict[str, str] = {
    "brand_inquiry": "product_pipeline",
    "pricing": "product_pipeline",
    "recommendation": "recommendation_pipeline",
    "discovery": "discovery_pipeline",
    "booking": "booking_pipeline",
    "promotion": "promotion_pipeline",
    "comparison": "comparison_pipeline",
    "objection": "objection_pipeline",
    "safety": "safety_pipeline",
    "doctor_inquiry": "doctor_pipeline",
    "location_hours": "location_hours_pipeline",
    "general": "general_pipeline",
}


PIPELINE_CONFIG: Dict[str, Dict[str, Any]] = {
    "product_pipeline": {
        "description": "ใช้ตอบเรื่องยี่ห้อ ราคา รุ่น รายละเอียดบริการ",
        "preferred_source_types": [
            "clinic_knowledge",
            "procedure_knowledge",
            "faq_knowledge",
            "promo_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "answer_first",
    },
    "recommendation_pipeline": {
        "description": "ใช้ตอบว่าแบบไหนเหมาะ ต้องการคำแนะนำ/เทียบทางเลือก",
        "preferred_source_types": [
            "clinic_knowledge",
            "procedure_knowledge",
            "comparison_knowledge",
            "doctor_profile_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": True,
        "response_mode": "consultative",
    },
    "discovery_pipeline": {
        "description": "ใช้ตอบลูกค้าที่เพิ่งเริ่มสนใจ อยากทำอะไรบางอย่าง",
        "preferred_source_types": [
            "clinic_knowledge",
            "procedure_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": True,
        "response_mode": "guided_discovery",
    },
    "booking_pipeline": {
        "description": "ใช้ตอบเรื่องการนัด จองคิว เวลา",
        "preferred_source_types": [
            "clinic_knowledge",
            "policy_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "booking_conversion",
    },
    "promotion_pipeline": {
        "description": "ใช้ตอบเรื่องโปร ส่วนลด ของแถม",
        "preferred_source_types": [
            "promo_knowledge",
            "clinic_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "promo_conversion",
    },
    "comparison_pipeline": {
        "description": "ใช้ตอบเรื่องต่างกันยังไง เทียบอะไรดีกว่า",
        "preferred_source_types": [
            "comparison_knowledge",
            "procedure_knowledge",
            "clinic_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": True,
        "response_mode": "structured_comparison",
    },
    "objection_pipeline": {
        "description": "ใช้ตอบข้อกังวล เช่น แพง กลัว เจ็บไหม คุ้มไหม",
        "preferred_source_types": [
            "faq_knowledge",
            "clinic_knowledge",
            "procedure_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": True,
        "response_mode": "objection_handling",
    },
    "safety_pipeline": {
        "description": "ใช้ตอบเรื่องความปลอดภัย ผลข้างเคียง ความเสี่ยง",
        "preferred_source_types": [
            "policy_knowledge",
            "procedure_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "safe_informative",
    },
    "doctor_pipeline": {
        "description": "ใช้ตอบเรื่องคุณหมอ/แพทย์",
        "preferred_source_types": [
            "doctor_profile_knowledge",
            "clinic_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "trust_building",
    },
    "location_hours_pipeline": {
        "description": "ใช้ตอบเรื่องสาขา เวลาเปิดปิด ที่ตั้ง",
        "preferred_source_types": [
            "clinic_knowledge",
            "faq_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "operational_info",
    },
    "general_pipeline": {
        "description": "fallback สำหรับคำถามทั่วไป",
        "preferred_source_types": [
            "clinic_knowledge",
            "faq_knowledge",
            "procedure_knowledge",
        ],
        "use_clinic_knowledge_first": True,
        "inject_similar_conversations": False,
        "response_mode": "general_helpful",
    },
}


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip().lower()


def _safe_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


@dataclass
class BrainRoutingResult:
    intent: str
    pipeline: str
    preferred_source_types: List[str]
    use_clinic_knowledge_first: bool
    inject_similar_conversations: bool
    response_mode: str
    reasoning: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not self.intent:
            errors.append("intent is required")
        if self.pipeline not in SUPPORTED_PIPELINES:
            errors.append(f"unsupported pipeline: {self.pipeline}")
        if not isinstance(self.preferred_source_types, list):
            errors.append("preferred_source_types must be list")
        if not isinstance(self.use_clinic_knowledge_first, bool):
            errors.append("use_clinic_knowledge_first must be bool")
        if not isinstance(self.inject_similar_conversations, bool):
            errors.append("inject_similar_conversations must be bool")
        if not self.response_mode:
            errors.append("response_mode is required")
        return {"valid": len(errors) == 0, "errors": errors}


class BrainRouter:
    def route_intent(self, intent: str) -> BrainRoutingResult:
        normalized_intent = _normalize_text(intent)
        pipeline = INTENT_PIPELINE_MAP.get(normalized_intent, "general_pipeline")
        config = _safe_dict(PIPELINE_CONFIG.get(pipeline))
        return BrainRoutingResult(
            intent=normalized_intent or "general",
            pipeline=pipeline,
            preferred_source_types=config.get("preferred_source_types", []),
            use_clinic_knowledge_first=bool(config.get("use_clinic_knowledge_first", True)),
            inject_similar_conversations=bool(config.get("inject_similar_conversations", False)),
            response_mode=config.get("response_mode", "general_helpful"),
            reasoning=f"intent_map:{normalized_intent}->{pipeline}",
        )

    def get_pipeline_config(self, pipeline: str) -> Dict[str, Any]:
        normalized_pipeline = _normalize_text(pipeline)
        return _safe_dict(PIPELINE_CONFIG.get(normalized_pipeline))


_router = BrainRouter()


def route_intent(intent: str) -> Dict[str, Any]:
    result = _router.route_intent(intent)
    return result.to_dict()


if __name__ == "__main__":
    test_intents = [
        "brand_inquiry",
        "pricing",
        "recommendation",
        "discovery",
        "booking",
        "promotion",
        "comparison",
        "objection",
        "safety",
        "doctor_inquiry",
        "location_hours",
        "general",
        "unknown_intent",
    ]
    router = BrainRouter()
    for intent in test_intents:
        r = router.route_intent(intent)
        print(intent, "=>", r.to_dict(), r.validate())
