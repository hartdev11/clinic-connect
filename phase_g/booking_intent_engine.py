
from __future__ import annotations
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

@dataclass
class BookingIntentRecord:
    booking_intent_id: str
    lead_id: str
    customer_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    procedure_id: Optional[str]
    service_name: Optional[str]
    quoted_price: Optional[float]
    promotion_id: Optional[str]
    intent_detected: bool
    intent_confidence: int
    requested_date: Optional[str]
    requested_time: Optional[str]
    contact_required: bool
    handoff_required: bool
    next_action: str
    reasons: List[str]

class BookingIntentEngine:
    def __init__(self):
        self.strong_booking_keywords = ["จอง","นัด","วันนี้ว่างไหม","มีคิวไหม","book","appointment"]
        self.time_keywords = ["พรุ่งนี้","วันนี้","เสาร์","อาทิตย์","เช้า","บ่าย","เย็น"]
        self.contact_keywords = ["โทร","ไลน์","line","เบอร์","ติดต่อ"]
        self.handoff_keywords = ["แอดมิน","พนักงาน","เจ้าหน้าที่","doctor","แพทย์"]

    def evaluate(self, intake_result, pipeline_result, score_result, offer_result):
        event = intake_result["canonical_event"]
        lead = intake_result["lead"]
        customer = intake_result["customer"]
        pipeline = pipeline_result["pipeline"]
        text = (event.get("message_text") or "").lower()

        intent_detected = False
        confidence = 0
        reasons = []

        if any(k in text for k in self.strong_booking_keywords):
            intent_detected = True; confidence += 45; reasons.append("strong_booking+45")
        if pipeline.get("booking_intent"):
            intent_detected = True; confidence += 30; reasons.append("pipeline_booking+30")

        lead_score = getattr(score_result, "score", 0)
        if lead_score >= 80: confidence += 15; reasons.append("hot_lead+15")
        elif lead_score >= 60: confidence += 8; reasons.append("warm_lead+8")

        proc_id = getattr(offer_result, "selected_procedure_id", None)
        if proc_id: confidence += 5; reasons.append("offer_available+5")

        requested_date = next((k for k in ["วันนี้","พรุ่งนี้","เสาร์","อาทิตย์"] if k in text), None)
        requested_time = next((k for k in ["เช้า","บ่าย","เย็น"] if k in text), None)
        if requested_date: confidence += 5; reasons.append("date+5")
        if requested_time: confidence += 5; reasons.append("time+5")

        contact_required = any(k in text for k in self.contact_keywords)
        handoff_required = any(k in text for k in self.handoff_keywords) or pipeline.get("handoff_required", False)
        confidence = max(0, min(confidence, 100))

        if handoff_required: next_action = "handoff_to_staff"
        elif not intent_detected: next_action = "continue_sales_conversation"
        elif confidence >= 70 and requested_date and requested_time: next_action = "confirm_booking_slot"
        elif confidence >= 60: next_action = "request_time_slot"
        elif confidence >= 50 and contact_required: next_action = "request_contact_info"
        elif confidence >= 45: next_action = "push_booking_confirmation"
        else: next_action = "continue_sales_conversation"

        record = BookingIntentRecord(
            booking_intent_id=f"bi_{uuid.uuid4().hex[:10]}",
            lead_id=lead["lead_id"], customer_id=customer["customer_id"],
            tenant_id=lead["tenant_id"], clinic_id=lead["clinic_id"], branch_id=lead["branch_id"],
            procedure_id=proc_id, service_name=getattr(offer_result,"selected_service_name",None),
            quoted_price=getattr(offer_result,"selected_base_price",None),
            promotion_id=getattr(offer_result,"selected_promotion_id",None),
            intent_detected=intent_detected, intent_confidence=confidence,
            requested_date=requested_date, requested_time=requested_time,
            contact_required=contact_required, handoff_required=handoff_required,
            next_action=next_action, reasons=reasons
        )
        return {"booking_intent": asdict(record), "status": "ok"}
