
from __future__ import annotations
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional
from source_taxonomy import LeadStage

@dataclass
class PipelineRecord:
    pipeline_id: str
    lead_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    customer_id: str
    current_stage: str
    recommended_procedure_id: Optional[str]
    quoted_price: Optional[float]
    promotion_id: Optional[str]
    booking_intent: bool
    handoff_required: bool
    lost_reason: Optional[str]
    notes: List[str]

class InMemoryPipelineStore:
    def __init__(self):
        self.pipeline_by_lead_id: Dict[str, PipelineRecord] = {}

class SalesPipelineEngine:
    def __init__(self, store=None):
        self.store = store or InMemoryPipelineStore()

    def upsert_pipeline(self, intake_result, clinic_context):
        lead = intake_result["lead"]
        customer = intake_result["customer"]
        event = intake_result["canonical_event"]
        existing = self.store.pipeline_by_lead_id.get(lead["lead_id"])
        if existing:
            pipeline = self._update(existing, event, clinic_context)
        else:
            pipeline = self._create(lead, customer, event, clinic_context)
        self.store.pipeline_by_lead_id[lead["lead_id"]] = pipeline
        return {"pipeline": asdict(pipeline), "status": "ok"}

    def _create(self, lead, customer, event, clinic_context):
        text = (event.get("message_text") or "").lower()
        proc_id = self._select_procedure(text, clinic_context)
        price = self._lookup_price(clinic_context, proc_id) if proc_id else None
        promo = self._lookup_promo(clinic_context, proc_id) if proc_id else None
        stage = LeadStage.BOOKING_INTENT.value if any(k in text for k in ["จอง","นัด","book"]) else (LeadStage.PRICING_SENT.value if (any(k in text for k in ["ราคา","กี่บาท","โปร"]) and price) else LeadStage.ENGAGED.value)
        return PipelineRecord(
            pipeline_id=f"pipe_{uuid.uuid4().hex[:10]}",
            lead_id=lead["lead_id"], tenant_id=lead["tenant_id"],
            clinic_id=lead["clinic_id"], branch_id=lead["branch_id"],
            customer_id=customer["customer_id"], current_stage=stage,
            recommended_procedure_id=proc_id, quoted_price=price,
            promotion_id=promo, booking_intent=stage==LeadStage.BOOKING_INTENT.value,
            handoff_required=any(k in text for k in ["แพทย์","หมอ","doctor","แอดมิน"]),
            lost_reason=None, notes=["Pipeline created"]
        )

    def _update(self, pipeline, event, clinic_context):
        text = (event.get("message_text") or "").lower()
        if any(k in text for k in ["จอง","นัด","book"]):
            pipeline.current_stage = LeadStage.BOOKING_INTENT.value
            pipeline.booking_intent = True
        if any(k in text for k in ["แพทย์","หมอ","doctor","แอดมิน"]):
            pipeline.handoff_required = True
        return pipeline

    def _select_procedure(self, text, clinic_context):
        for s in clinic_context.available_services:
            tags = [str(x).lower() for x in s.get("service_tags", [])]
            if any(t in text for t in tags):
                return s.get("procedure_id")
        if clinic_context.available_services:
            return clinic_context.available_services[0].get("procedure_id")
        return "proc_001"

    def _lookup_price(self, clinic_context, procedure_id):
        for p in clinic_context.pricing:
            if p.get("procedure_id") == procedure_id:
                return float(p.get("base_price", 0))
        return 7999.0

    def _lookup_promo(self, clinic_context, procedure_id):
        for p in clinic_context.promotions:
            if p.get("procedure_id") in [procedure_id, "all"]:
                return p.get("promotion_id")
        return None

    def mark_booked(self, lead_id):
        pipeline = self.store.pipeline_by_lead_id.get(lead_id)
        if not pipeline:
            return {"status": "error"}
        pipeline.current_stage = LeadStage.BOOKED.value
        return {"pipeline": asdict(pipeline), "status": "ok"}
