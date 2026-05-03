
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

@dataclass
class OfferSelectionResult:
    selected_procedure_id: Optional[str]
    selected_service_name: Optional[str]
    selected_base_price: Optional[float]
    selected_promotion_id: Optional[str]
    selected_promotion_text: Optional[str]
    cta_strategy: str
    lead_level: str
    candidates: List[Dict[str, Any]]

class OfferSelector:
    def __init__(self):
        self.high_intent_keywords = ["ราคา","กี่บาท","โปร","จอง","นัด","วันนี้","book"]
        self.slim_face_keywords = ["หน้าเรียว","กราม","jaw","jawline","botox"]
        self.lifting_keywords = ["ยกกระชับ","lifting","hifu","ulthera","thermage"]
        self.skin_keywords = ["หน้าใส","ผิว","สิว","รูขุมขน","skin","bright"]

    def select_best_offer(self, intake_result, pipeline_result, score_result, clinic_context):
        event = intake_result["canonical_event"]
        pipeline = pipeline_result["pipeline"]
        text = (event.get("message_text") or "").lower()
        lead_level = getattr(score_result, "level", "cold")

        candidates = []
        services = clinic_context.available_services or [{"procedure_id":"proc_001","service_name":"Botox","service_tags":["botox","jawline"]}]
        pricing = clinic_context.pricing or [{"procedure_id":"proc_001","base_price":7999}]
        promotions = clinic_context.promotions or []

        for service in services:
            proc_id = service.get("procedure_id")
            service_name = service.get("service_name","")
            tags = [str(x).lower() for x in service.get("service_tags",[])]
            score = 0
            reasons = []

            if pipeline.get("recommended_procedure_id") == proc_id: score += 40; reasons.append("pipeline+40")
            if any(t in text for t in tags): score += 25; reasons.append("tag_match+25")
            if any(k in text for k in self.slim_face_keywords) and any(t in tags for t in ["botox","jawline","slim_face"]): score += 18; reasons.append("slim_face+18")
            if any(k in text for k in self.lifting_keywords) and any(t in tags for t in ["lifting","hifu","ulthera"]): score += 18; reasons.append("lifting+18")
            if any(k in text for k in self.high_intent_keywords): score += 10; reasons.append("high_intent+10")
            if lead_level == "hot": score += 8; reasons.append("hot+8")
            elif lead_level == "warm": score += 4; reasons.append("warm+4")

            price = next((float(p.get("base_price",0)) for p in pricing if p.get("procedure_id")==proc_id), 7999.0)
            promo = next((p for p in promotions if p.get("procedure_id") in [proc_id,"all"]), None)

            candidates.append({"procedure_id":proc_id,"service_name":service_name,"base_price":price,"promotion_id":promo.get("promotion_id") if promo else None,"promotion_text":promo.get("promotion_text") if promo else None,"score":score,"reasons":reasons})

        candidates.sort(key=lambda x: x["score"], reverse=True)
        best = candidates[0] if candidates else None

        booking_intent = pipeline.get("booking_intent", False)
        has_promo = bool(best and best.get("promotion_id"))

        if booking_intent and has_promo: cta = "push_booking_with_urgency"
        elif booking_intent: cta = "push_booking_now"
        elif lead_level == "hot" and has_promo: cta = "promotion_close"
        elif lead_level == "hot": cta = "price_and_close"
        elif lead_level == "warm": cta = "educate_then_offer"
        else: cta = "soft_consultation"

        return OfferSelectionResult(
            selected_procedure_id=best["procedure_id"] if best else "proc_001",
            selected_service_name=best["service_name"] if best else "Botox",
            selected_base_price=best["base_price"] if best else 7999.0,
            selected_promotion_id=best["promotion_id"] if best else None,
            selected_promotion_text=best["promotion_text"] if best else None,
            cta_strategy=cta, lead_level=lead_level,
            candidates=candidates
        )
