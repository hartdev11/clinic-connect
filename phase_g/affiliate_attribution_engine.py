
from __future__ import annotations
import uuid
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional

@dataclass
class AffiliateAttributionRecord:
    attribution_id: str
    lead_id: str
    customer_id: str
    booking_id: Optional[str]
    tenant_id: str
    clinic_id: str
    branch_id: str
    source_platform: str
    source_type: str
    campaign_id: Optional[str]
    affiliate_id: Optional[str]
    attribution_model: str
    attributed_revenue: float
    commission_rate: float
    commission_amount: float
    notes: str

class AffiliateAttributionEngine:
    def __init__(self, default_commission_rate: float = 0.10):
        self.default_commission_rate = default_commission_rate

    def attribute(self, intake_result, *, booking_result=None, attribution_model="last_touch", affiliate_rules=None):
        lead = intake_result["lead"]
        customer = intake_result["customer"]
        event = intake_result["canonical_event"]
        affiliate_id = event.get("affiliate_id")
        booking_id = None
        attributed_revenue = 0.0
        if booking_result and booking_result.get("status") == "ok":
            booking = booking_result["booking"]
            booking_id = booking.get("booking_id")
            attributed_revenue = float(booking.get("quoted_price", 0.0))
        rate = float((affiliate_rules or {}).get(affiliate_id, self.default_commission_rate)) if affiliate_id else self.default_commission_rate
        commission_amount = round(attributed_revenue * rate, 2)
        record = AffiliateAttributionRecord(
            attribution_id=f"attr_{uuid.uuid4().hex[:10]}",
            lead_id=lead["lead_id"], customer_id=customer["customer_id"],
            booking_id=booking_id, tenant_id=lead["tenant_id"],
            clinic_id=lead["clinic_id"], branch_id=lead["branch_id"],
            source_platform=event.get("source_platform",""),
            source_type=event.get("source_type",""),
            campaign_id=event.get("campaign_id"), affiliate_id=affiliate_id,
            attribution_model=attribution_model,
            attributed_revenue=attributed_revenue, commission_rate=rate,
            commission_amount=commission_amount,
            notes=f"model={attribution_model}|aff={affiliate_id}|rev={attributed_revenue}|rate={rate}"
        )
        return {"status": "ok", "attribution": asdict(record)}
