
from __future__ import annotations
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

@dataclass
class HandoffRecord:
    handoff_id: str
    lead_id: str
    customer_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    handoff_required: bool
    handoff_target: Optional[str]
    handoff_reason: Optional[str]
    priority: str
    source_module: str
    latest_message_text: Optional[str]
    notes: List[str]

class HandoffEngine:
    def __init__(self):
        self.doctor_keywords = ["แพทย์","หมอ","doctor","ขอคุยหมอ"]
        self.risk_keywords = ["อันตราย","ผลข้างเคียง","แพ้","เลือด","เสี่ยง"]
        self.complaint_keywords = ["ร้องเรียน","ไม่พอใจ","แย่มาก","จะฟ้อง","เสียหาย"]
        self.vip_keywords = ["vip","ผู้บริหาร","ดารา","influencer"]
        self.manual_keywords = ["แอดมิน","เจ้าหน้าที่","พนักงาน","โทรกลับ","ขอคนตอบ"]

    def evaluate(self, intake_result, pipeline_result=None, booking_intent_result=None, customer_summary=None):
        event = intake_result["canonical_event"]
        lead = intake_result["lead"]
        customer = intake_result["customer"]
        text = (event.get("message_text") or "").lower()

        handoff_required = False
        handoff_target = None
        handoff_reason = None
        priority = "low"
        source_module = "message_guard"
        notes = []

        if any(k in text for k in self.complaint_keywords):
            handoff_required = True; handoff_target = "support"; handoff_reason = "complaint"; priority = "urgent"; notes.append("complaint_detected")
        elif any(k in text for k in self.risk_keywords):
            handoff_required = True; handoff_target = "doctor"; handoff_reason = "medical_risk"; priority = "high"; notes.append("risk_detected")
        elif any(k in text for k in self.doctor_keywords):
            handoff_required = True; handoff_target = "doctor"; handoff_reason = "doctor_requested"; priority = "high"; notes.append("doctor_requested")
        elif any(k in text for k in self.manual_keywords):
            handoff_required = True; handoff_target = "admin"; handoff_reason = "manual_staff_requested"; priority = "medium"; notes.append("manual_requested")
        elif any(k in text for k in self.vip_keywords):
            handoff_required = True; handoff_target = "senior_sales"; handoff_reason = "vip"; priority = "high"; notes.append("vip_detected")

        if pipeline_result and not handoff_required:
            if pipeline_result.get("pipeline", {}).get("handoff_required"):
                handoff_required = True; handoff_target = "admin"; handoff_reason = "pipeline_handoff"; priority = "medium"; source_module = "pipeline"; notes.append("pipeline_handoff")

        if not handoff_required: notes.append("no_handoff_required")

        record = HandoffRecord(
            handoff_id=f"ho_{uuid.uuid4().hex[:10]}",
            lead_id=lead["lead_id"], customer_id=customer["customer_id"],
            tenant_id=lead["tenant_id"], clinic_id=lead["clinic_id"], branch_id=lead["branch_id"],
            handoff_required=handoff_required, handoff_target=handoff_target,
            handoff_reason=handoff_reason, priority=priority, source_module=source_module,
            latest_message_text=event.get("message_text"), notes=notes
        )
        return {"status": "ok", "handoff": asdict(record), "next_action": "handoff_to_staff" if handoff_required else "continue_ai_flow"}
