from __future__ import annotations

import re
from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional


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


def _extract_price_ranges(text: str) -> List[str]:
    text = _normalize_text(text)
    if not text:
        return []
    patterns = [
        r"\d{1,3}(?:,\d{3})+(?:\s*-\s*\d{1,3}(?:,\d{3})+)?\s*บาท",
        r"\d{4,6}(?:\s*-\s*\d{4,6})?\s*บาท",
        r"\d{1,3}(?:,\d{3})+\s*-\s*\d{1,3}(?:,\d{3})+",
        r"\d{4,6}\s*-\s*\d{4,6}",
    ]
    matches: List[str] = []
    for pattern in patterns:
        matches.extend(re.findall(pattern, text, flags=re.IGNORECASE))
    return _dedupe_keep_order(matches)


def _contains_price_signal(text: str) -> bool:
    lowered = _normalize_text_lower(text)
    return any(s in lowered for s in ["บาท", "ราคา", "เริ่มต้น", "price"])


def _contains_brand_signal(text: str) -> bool:
    lowered = _normalize_text_lower(text)
    signals = [
        "juvederm", "restylane", "belotero", "neuramis", "e.p.t.q", "eptq",
        "yvoire", "definisse", "teosyal", "filler", "ฟิลเลอร์", "ยี่ห้อ", "แบรนด์",
    ]
    return any(s in lowered for s in signals)


def _contains_recommendation_signal(text: str) -> bool:
    lowered = _normalize_text_lower(text)
    signals = [
        "เหมาะ", "แนะนำ", "ธรรมชาติ", "ทรงชัด", "อิ่มฟู", "ลุค", "เหมาะกับ",
        "recommend", "natural", "defined",
    ]
    return any(s in lowered for s in signals)


@dataclass
class ContextChunk:
    text: str
    score: float
    source_scope: str
    source_type: str
    clinic_id: Optional[str]
    tenant_id: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BuiltContext:
    intent: str
    pipeline: str
    response_mode: str
    clinic_brands: List[str] = field(default_factory=list)
    global_brands: List[str] = field(default_factory=list)
    price_ranges: List[str] = field(default_factory=list)
    procedure_summary: List[str] = field(default_factory=list)
    recommendation_hints: List[str] = field(default_factory=list)
    clinic_chunks: List[ContextChunk] = field(default_factory=list)
    global_chunks: List[ContextChunk] = field(default_factory=list)
    similar_conversations: List[str] = field(default_factory=list)
    final_context_blocks: List[str] = field(default_factory=list)
    reasoning: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "intent": self.intent,
            "pipeline": self.pipeline,
            "response_mode": self.response_mode,
            "clinic_brands": self.clinic_brands,
            "global_brands": self.global_brands,
            "price_ranges": self.price_ranges,
            "procedure_summary": self.procedure_summary,
            "recommendation_hints": self.recommendation_hints,
            "clinic_chunks": [x.to_dict() for x in self.clinic_chunks],
            "global_chunks": [x.to_dict() for x in self.global_chunks],
            "similar_conversations": self.similar_conversations,
            "final_context_blocks": self.final_context_blocks,
            "reasoning": self.reasoning,
        }

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if not self.intent:
            errors.append("intent is required")
        if not self.pipeline:
            errors.append("pipeline is required")
        if not self.response_mode:
            errors.append("response_mode is required")
        if not isinstance(self.clinic_brands, list):
            errors.append("clinic_brands must be list")
        if not isinstance(self.global_brands, list):
            errors.append("global_brands must be list")
        if not isinstance(self.price_ranges, list):
            errors.append("price_ranges must be list")
        if not isinstance(self.procedure_summary, list):
            errors.append("procedure_summary must be list")
        if not isinstance(self.recommendation_hints, list):
            errors.append("recommendation_hints must be list")
        if not isinstance(self.final_context_blocks, list):
            errors.append("final_context_blocks must be list")
        return {"valid": len(errors) == 0, "errors": errors}


class ContextBuilder:
    def build_context(
        self,
        intent: str,
        routing_result: Dict[str, Any],
        retrieval_results: List[Dict[str, Any]],
        similar_conversations: Optional[List[str]] = None,
    ) -> BuiltContext:
        normalized_intent = _normalize_text_lower(intent)
        pipeline = _normalize_text(routing_result.get("pipeline"))
        response_mode = _normalize_text(routing_result.get("response_mode"))

        clinic_chunks: List[ContextChunk] = []
        global_chunks: List[ContextChunk] = []
        clinic_brands: List[str] = []
        global_brands: List[str] = []
        price_ranges: List[str] = []
        procedure_summary: List[str] = []
        recommendation_hints: List[str] = []

        for item in retrieval_results:
            item_dict = _safe_dict(item)
            text = _normalize_text(item_dict.get("text"))
            score = float(item_dict.get("score") or 0.0)
            metadata = _safe_dict(item_dict.get("metadata"))
            scope = _normalize_text_lower(metadata.get("scope") or metadata.get("source_scope") or "global")
            source_type = _normalize_text_lower(metadata.get("source_type"))
            clinic_id = metadata.get("clinic_id")
            tenant_id = metadata.get("tenant_id")

            chunk = ContextChunk(
                text=text,
                score=score,
                source_scope=scope,
                source_type=source_type,
                clinic_id=clinic_id,
                tenant_id=tenant_id,
                metadata=metadata,
            )
            if scope == "clinic":
                clinic_chunks.append(chunk)
            else:
                global_chunks.append(chunk)

            metadata_brand = metadata.get("brand")
            metadata_brand_list = _safe_list(metadata.get("brands"))
            if metadata_brand:
                (clinic_brands if scope == "clinic" else global_brands).append(_normalize_text(metadata_brand))
            for b in metadata_brand_list:
                (clinic_brands if scope == "clinic" else global_brands).append(_normalize_text(b))

            metadata_price = metadata.get("price_range") or metadata.get("price")
            if metadata_price:
                price_ranges.append(_normalize_text(metadata_price))

            if _contains_brand_signal(text):
                extracted_brands = self._extract_known_brands(text)
                if scope == "clinic":
                    clinic_brands.extend(extracted_brands)
                else:
                    global_brands.extend(extracted_brands)

            if _contains_price_signal(text):
                price_ranges.extend(_extract_price_ranges(text))

            if source_type in {"procedure_knowledge", "clinic_knowledge", "faq_knowledge"}:
                procedure_summary.append(text)
            if _contains_recommendation_signal(text):
                recommendation_hints.append(text)

        clinic_brands = _dedupe_keep_order(clinic_brands)
        global_brands = _dedupe_keep_order(global_brands)
        price_ranges = _dedupe_keep_order(price_ranges)
        procedure_summary = _dedupe_keep_order(procedure_summary)[:5]
        recommendation_hints = _dedupe_keep_order(recommendation_hints)[:5]

        final_context_blocks = self._build_final_context_blocks(
            intent=normalized_intent,
            pipeline=pipeline,
            clinic_brands=clinic_brands,
            global_brands=global_brands,
            price_ranges=price_ranges,
            procedure_summary=procedure_summary,
            recommendation_hints=recommendation_hints,
            clinic_chunks=clinic_chunks,
            global_chunks=global_chunks,
            similar_conversations=similar_conversations or [],
        )

        return BuiltContext(
            intent=normalized_intent,
            pipeline=pipeline,
            response_mode=response_mode,
            clinic_brands=clinic_brands,
            global_brands=global_brands,
            price_ranges=price_ranges,
            procedure_summary=procedure_summary,
            recommendation_hints=recommendation_hints,
            clinic_chunks=clinic_chunks,
            global_chunks=global_chunks,
            similar_conversations=[_normalize_text(x) for x in (similar_conversations or []) if _normalize_text(x)],
            final_context_blocks=final_context_blocks,
            reasoning="clinic_first_then_global_context_build",
        )

    def render_prompt_context(self, built_context: BuiltContext) -> str:
        parts: List[str] = []
        parts.append(f"[INTENT]\n{built_context.intent}")
        parts.append(f"[PIPELINE]\n{built_context.pipeline}")
        parts.append(f"[RESPONSE MODE]\n{built_context.response_mode}")

        if built_context.clinic_brands:
            parts.append("[CLINIC BRAND LIST]\n" + "\n".join(f"- {x}" for x in built_context.clinic_brands))
        if built_context.global_brands:
            parts.append("[GLOBAL BRAND LIST]\n" + "\n".join(f"- {x}" for x in built_context.global_brands))
        if built_context.price_ranges:
            parts.append("[PRICE RANGE]\n" + "\n".join(f"- {x}" for x in built_context.price_ranges))
        if built_context.procedure_summary:
            parts.append("[PROCEDURE SUMMARY]\n" + "\n".join(f"- {x}" for x in built_context.procedure_summary[:5]))
        if built_context.recommendation_hints:
            parts.append("[RECOMMENDATION HINTS]\n" + "\n".join(f"- {x}" for x in built_context.recommendation_hints[:5]))
        if built_context.similar_conversations:
            parts.append("[SIMILAR CONVERSATIONS]\n" + "\n".join(f"- {x}" for x in built_context.similar_conversations[:3]))
        if built_context.final_context_blocks:
            parts.append("[RAW CONTEXT BLOCKS]\n" + "\n".join(f"- {x}" for x in built_context.final_context_blocks[:8]))
        return "\n\n".join(parts)

    def _extract_known_brands(self, text: str) -> List[str]:
        lowered = _normalize_text_lower(text)
        known_brands = ["Juvederm", "Restylane", "Belotero", "Neuramis", "e.p.t.q", "Yvoire", "Definisse", "Teosyal"]
        found: List[str] = []
        for brand in known_brands:
            if brand.lower() in lowered:
                found.append(brand)
        return found

    def _build_final_context_blocks(
        self,
        intent: str,
        pipeline: str,
        clinic_brands: List[str],
        global_brands: List[str],
        price_ranges: List[str],
        procedure_summary: List[str],
        recommendation_hints: List[str],
        clinic_chunks: List[ContextChunk],
        global_chunks: List[ContextChunk],
        similar_conversations: List[str],
    ) -> List[str]:
        blocks: List[str] = []
        if clinic_brands:
            blocks.append("Clinic brands: " + ", ".join(clinic_brands))
        if not clinic_brands and global_brands:
            blocks.append("Global brands: " + ", ".join(global_brands))
        if price_ranges:
            blocks.append("Price ranges: " + ", ".join(price_ranges))
        for item in procedure_summary[:3]:
            blocks.append(item)
        for item in recommendation_hints[:2]:
            if item not in blocks:
                blocks.append(item)
        for chunk in sorted(clinic_chunks, key=lambda x: x.score, reverse=True)[:4]:
            if chunk.text not in blocks:
                blocks.append(chunk.text)
        for chunk in sorted(global_chunks, key=lambda x: x.score, reverse=True)[:4]:
            if chunk.text not in blocks:
                blocks.append(chunk.text)
        for conv in similar_conversations[:3]:
            if conv not in blocks:
                blocks.append(conv)
        return _dedupe_keep_order(blocks)


_builder = ContextBuilder()


def build_context(
    intent: str,
    routing_result: Dict[str, Any],
    retrieval_results: List[Dict[str, Any]],
    similar_conversations: Optional[List[str]] = None,
) -> Dict[str, Any]:
    result = _builder.build_context(
        intent=intent,
        routing_result=routing_result,
        retrieval_results=retrieval_results,
        similar_conversations=similar_conversations,
    )
    return result.to_dict()


def render_prompt_context(built_context: Dict[str, Any]) -> str:
    context = BuiltContext(
        intent=_normalize_text_lower(built_context.get("intent")),
        pipeline=_normalize_text(built_context.get("pipeline")),
        response_mode=_normalize_text(built_context.get("response_mode")),
        clinic_brands=_safe_list(built_context.get("clinic_brands")),
        global_brands=_safe_list(built_context.get("global_brands")),
        price_ranges=_safe_list(built_context.get("price_ranges")),
        procedure_summary=_safe_list(built_context.get("procedure_summary")),
        recommendation_hints=_safe_list(built_context.get("recommendation_hints")),
        clinic_chunks=[ContextChunk(**x) if isinstance(x, dict) else x for x in _safe_list(built_context.get("clinic_chunks"))],
        global_chunks=[ContextChunk(**x) if isinstance(x, dict) else x for x in _safe_list(built_context.get("global_chunks"))],
        similar_conversations=_safe_list(built_context.get("similar_conversations")),
        final_context_blocks=_safe_list(built_context.get("final_context_blocks")),
        reasoning=_normalize_text(built_context.get("reasoning")),
    )
    return _builder.render_prompt_context(context)
