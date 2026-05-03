
from __future__ import annotations
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

@dataclass
class BookingRecord:
    booking_id: str
    booking_intent_id: str
    lead_id: str
    customer_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    procedure_id: str
    service_name: str
    quoted_price: float
    promotion_id: Optional[str]
    requested_date: Optional[str]
    requested_time: Optional[str]
    booking_status: str
    booking_source: str
    assigned_staff_id: Optional[str]
    notes: str

class BookingEngine:
    def create_booking(self, booking_intent_result, *, assigned_staff_id=None):
        bi = booking_intent_result["booking_intent"]
        err = self._validate(bi)
        if err: return {"status": "error", "error": err}
        status = "pending_confirmation" if (bi.get("requested_date") and bi.get("requested_time")) else "pending_slot_selection"
        booking = BookingRecord(
            booking_id=f"bk_{uuid.uuid4().hex[:10]}",
            booking_intent_id=bi["booking_intent_id"],
            lead_id=bi["lead_id"], customer_id=bi["customer_id"],
            tenant_id=bi["tenant_id"], clinic_id=bi["clinic_id"], branch_id=bi["branch_id"],
            procedure_id=bi["procedure_id"] or "proc_001",
            service_name=bi.get("service_name") or "",
            quoted_price=float(bi["quoted_price"] or 0),
            promotion_id=bi.get("promotion_id"),
            requested_date=bi.get("requested_date"),
            requested_time=bi.get("requested_time"),
            booking_status=status,
            booking_source="ai_sales_pipeline",
            assigned_staff_id=assigned_staff_id,
            notes=f"status={status}|confidence={bi.get('intent_confidence')}|action={bi.get('next_action')}"
        )
        return {"status": "ok", "booking": asdict(booking)}

    def _validate(self, bi):
        if not bi.get("intent_detected"): return "booking_intent_not_detected"
        if bi.get("intent_confidence", 0) < 45: return "confidence_too_low"
        if not bi.get("procedure_id"): return "missing_procedure_id"
        if bi.get("quoted_price") in [None, 0, 0.0]: return "missing_quoted_price"
        if bi.get("handoff_required"): return "handoff_required_before_booking"
        return None
