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


@dataclass
class HardContextPacket:
    intent: str
    pipeline: str
    response_mode: str
    clinic_facts: Dict[str, Any] = field(default_factory=dict)
    global_facts: Dict[str, Any] = field(default_factory=dict)
    decision_packet: Dict[str, Any] = field(default_factory=dict)
    allowed_brands: List[str] = field(default_factory=list)
    allowed_prices: List[str] = field(default_factory=list)
    recommended_items: List[str] = field(default_factory=list)
    evidence_blocks: List[str] = field(default_factory=list)
    cta_type: Optional[str] = None
    cta_message_hint: Optional[str] = None
    hard_rules: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    rendered_text: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not self.intent:
            errors.append("intent is required")
        if not self.pipeline:
            errors.append("pipeline is required")
        if not self.response_mode:
            errors.append("response_mode is required")
        if not isinstance(self.clinic_facts, dict):
            errors.append("clinic_facts must be dict")
        if not isinstance(self.global_facts, dict):
            errors.append("global_facts must be dict")
        if not isinstance(self.decision_packet, dict):
            errors.append("decision_packet must be dict")
        if not isinstance(self.allowed_brands, list):
            errors.append("allowed_brands must be list")
        if not isinstance(self.allowed_prices, list):
            errors.append("allowed_prices must be list")
        if not isinstance(self.recommended_items, list):
            errors.append("recommended_items must be list")
        if not isinstance(self.evidence_blocks, list):
            errors.append("evidence_blocks must be list")
        if not isinstance(self.hard_rules, list):
            errors.append("hard_rules must be list")
        if not isinstance(self.warnings, list):
            errors.append("warnings must be list")
        return {"valid": len(errors) == 0, "errors": errors}


class HardContextBuilder:
    def build_hard_context(
        self,
        built_context: Dict[str, Any],
        decision_packet: Dict[str, Any],
    ) -> HardContextPacket:
        ctx = _safe_dict(built_context)
        decision = _safe_dict(decision_packet)

        intent = _normalize_text_lower(ctx.get("intent"))
        pipeline = _normalize_text_lower(ctx.get("pipeline"))
        response_mode = _normalize_text_lower(ctx.get("response_mode"))

        clinic_brands = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("clinic_brands"))])
        global_brands = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("global_brands"))])
        price_ranges = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("price_ranges"))])
        procedure_summary = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(ctx.get("procedure_summary"))])
        recommendation_hints = _dedupe_keep_order(
            [_normalize_text(x) for x in _safe_list(ctx.get("recommendation_hints"))]
        )
        final_context_blocks = _dedupe_keep_order(
            [_normalize_text(x) for x in _safe_list(ctx.get("final_context_blocks"))]
        )

        decision_brands = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(decision.get("brands_to_mention"))])
        decision_prices = _dedupe_keep_order(
            [_normalize_text(x) for x in _safe_list(decision.get("price_ranges_to_mention"))]
        )
        decision_evidence = _dedupe_keep_order([_normalize_text(x) for x in _safe_list(decision.get("evidence_blocks"))])

        recommendation_options = _safe_list(decision.get("recommendation_options"))
        recommended_items = self._extract_recommended_items(
            recommendation_options=recommendation_options,
            primary_recommendation=decision.get("primary_recommendation"),
        )

        allowed_brands = clinic_brands[:] if clinic_brands else global_brands[:]
        if decision_brands:
            allowed_brands = _dedupe_keep_order(decision_brands + allowed_brands)

        allowed_prices = _dedupe_keep_order(decision_prices + price_ranges)
        evidence_blocks = _dedupe_keep_order(decision_evidence + final_context_blocks)[:8]

        clinic_facts = {
            "brands": clinic_brands,
            "price_ranges": allowed_prices,
            "procedure_summary": procedure_summary[:5],
            "recommendation_hints": recommendation_hints[:5],
        }
        global_facts = {
            "brands": [x for x in global_brands if x not in clinic_brands],
            "context_blocks": [x for x in final_context_blocks if x not in procedure_summary][:5],
        }

        hard_rules = self._build_hard_rules(
            intent=intent,
            allowed_brands=allowed_brands,
            allowed_prices=allowed_prices,
            recommended_items=recommended_items,
        )
        warnings = self._build_warnings(
            intent=intent,
            allowed_brands=allowed_brands,
            allowed_prices=allowed_prices,
            decision_packet=decision,
        )

        packet = HardContextPacket(
            intent=intent,
            pipeline=pipeline,
            response_mode=response_mode,
            clinic_facts=clinic_facts,
            global_facts=global_facts,
            decision_packet=decision,
            allowed_brands=allowed_brands[:5],
            allowed_prices=allowed_prices[:3],
            recommended_items=recommended_items[:5],
            evidence_blocks=evidence_blocks,
            cta_type=_normalize_text(decision.get("cta_type")) or None,
            cta_message_hint=_normalize_text(decision.get("cta_message_hint")) or None,
            hard_rules=hard_rules,
            warnings=warnings,
        )
        packet.rendered_text = self.render_hard_context(packet)
        return packet

    def render_hard_context(self, packet: HardContextPacket) -> str:
        sections: List[str] = [
            f"[INTENT]\n{packet.intent}",
            f"[PIPELINE]\n{packet.pipeline}",
            f"[RESPONSE MODE]\n{packet.response_mode}",
        ]

        if packet.allowed_brands:
            sections.append("[ALLOWED BRANDS]\n" + "\n".join(f"- {x}" for x in packet.allowed_brands))
        if packet.allowed_prices:
            sections.append("[ALLOWED PRICE RANGES]\n" + "\n".join(f"- {x}" for x in packet.allowed_prices))

        clinic_summary_lines: List[str] = []
        for item in _safe_list(packet.clinic_facts.get("procedure_summary"))[:5]:
            clinic_summary_lines.append(f"- {item}")
        for item in _safe_list(packet.clinic_facts.get("recommendation_hints"))[:5]:
            line = f"- {item}"
            if line not in clinic_summary_lines:
                clinic_summary_lines.append(line)
        if clinic_summary_lines:
            sections.append("[CLINIC FACTS]\n" + "\n".join(clinic_summary_lines))

        global_lines: List[str] = []
        for item in _safe_list(packet.global_facts.get("brands"))[:5]:
            global_lines.append(f"- {item}")
        for item in _safe_list(packet.global_facts.get("context_blocks"))[:5]:
            line = f"- {item}"
            if line not in global_lines:
                global_lines.append(line)
        if global_lines:
            sections.append("[GLOBAL SUPPORTING FACTS]\n" + "\n".join(global_lines))

        if packet.recommended_items:
            sections.append("[RECOMMENDED ITEMS]\n" + "\n".join(f"- {x}" for x in packet.recommended_items))
        if packet.evidence_blocks:
            sections.append("[EVIDENCE BLOCKS]\n" + "\n".join(f"- {x}" for x in packet.evidence_blocks))
        if packet.cta_type or packet.cta_message_hint:
            cta_lines: List[str] = []
            if packet.cta_type:
                cta_lines.append(f"- cta_type: {packet.cta_type}")
            if packet.cta_message_hint:
                cta_lines.append(f"- cta_message_hint: {packet.cta_message_hint}")
            sections.append("[CTA PLAN]\n" + "\n".join(cta_lines))
        if packet.hard_rules:
            sections.append("[HARD RULES]\n" + "\n".join(f"- {x}" for x in packet.hard_rules))
        if packet.warnings:
            sections.append("[WARNINGS]\n" + "\n".join(f"- {x}" for x in packet.warnings))

        return "\n\n".join(sections)

    def _extract_recommended_items(
        self,
        recommendation_options: List[Any],
        primary_recommendation: Any,
    ) -> List[str]:
        items: List[str] = []
        primary = _normalize_text(primary_recommendation)
        if primary:
            items.append(primary)
        for item in recommendation_options:
            item_dict = _safe_dict(item)
            label = _normalize_text(item_dict.get("label"))
            reason = _normalize_text(item_dict.get("reason"))
            if label:
                items.append(label)
            if reason:
                items.append(reason)
        return _dedupe_keep_order(items)

    def _build_hard_rules(
        self,
        intent: str,
        allowed_brands: List[str],
        allowed_prices: List[str],
        recommended_items: List[str],
    ) -> List[str]:
        rules: List[str] = [
            "ห้ามตอบจากความรู้ทั่วไปนอก context",
            "ห้ามใช้ข้อมูลที่ไม่มีใน hard context",
            "ต้องตอบคำถามหลักก่อนเสมอ",
            "ถามต่อได้ไม่เกิน 1 คำถาม",
        ]
        if intent == "brand_inquiry" and allowed_brands:
            rules.append("ต้องระบุชื่อแบรนด์จาก ALLOWED BRANDS อย่างน้อย 1 รายการ")
        if intent == "pricing" and allowed_prices:
            rules.append("ต้องตอบราคา/ช่วงราคาจาก ALLOWED PRICE RANGES")
        if intent in {"recommendation", "discovery"} and recommended_items:
            rules.append("ต้องใช้ RECOMMENDED ITEMS ในการตอบหรือแนะนำ")
        return rules

    def _build_warnings(
        self,
        intent: str,
        allowed_brands: List[str],
        allowed_prices: List[str],
        decision_packet: Dict[str, Any],
    ) -> List[str]:
        warnings: List[str] = []
        if intent == "brand_inquiry" and not allowed_brands:
            warnings.append("no_brand_fact_available")
        if intent == "pricing" and not allowed_prices:
            warnings.append("no_price_fact_available")
        if (
            not _normalize_text(decision_packet.get("primary_recommendation"))
            and intent in {"recommendation", "discovery"}
        ):
            warnings.append("no_primary_recommendation")
        return warnings


_default_builder = HardContextBuilder()


def build_hard_context(
    built_context: Dict[str, Any],
    decision_packet: Dict[str, Any],
) -> Dict[str, Any]:
    packet = _default_builder.build_hard_context(
        built_context=built_context,
        decision_packet=decision_packet,
    )
    return packet.to_dict()


def render_hard_context(hard_context: Dict[str, Any]) -> str:
    packet = HardContextPacket(
        intent=_normalize_text_lower(hard_context.get("intent")),
        pipeline=_normalize_text_lower(hard_context.get("pipeline")),
        response_mode=_normalize_text_lower(hard_context.get("response_mode")),
        clinic_facts=_safe_dict(hard_context.get("clinic_facts")),
        global_facts=_safe_dict(hard_context.get("global_facts")),
        decision_packet=_safe_dict(hard_context.get("decision_packet")),
        allowed_brands=[_normalize_text(x) for x in _safe_list(hard_context.get("allowed_brands"))],
        allowed_prices=[_normalize_text(x) for x in _safe_list(hard_context.get("allowed_prices"))],
        recommended_items=[_normalize_text(x) for x in _safe_list(hard_context.get("recommended_items"))],
        evidence_blocks=[_normalize_text(x) for x in _safe_list(hard_context.get("evidence_blocks"))],
        cta_type=_normalize_text(hard_context.get("cta_type")) or None,
        cta_message_hint=_normalize_text(hard_context.get("cta_message_hint")) or None,
        hard_rules=[_normalize_text(x) for x in _safe_list(hard_context.get("hard_rules"))],
        warnings=[_normalize_text(x) for x in _safe_list(hard_context.get("warnings"))],
        rendered_text=_normalize_text(hard_context.get("rendered_text")),
    )
    return _default_builder.render_hard_context(packet)

