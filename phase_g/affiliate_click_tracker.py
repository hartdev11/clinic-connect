
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class AffiliateClickRecord:
    click_id: str
    click_session_id: str
    affiliate_id: str
    referral_code: str
    campaign_id: Optional[str]
    tenant_id: Optional[str]
    source_platform: str
    source_type: Optional[str]
    landing_path: str
    visitor_id: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    is_active_link: bool
    linked_lead_id: Optional[str]
    linked_booking_id: Optional[str]
    linked_revenue: float
    attribution_model: str
    timestamp: str

class AffiliateClickStore:
    def __init__(self, storage_file="affiliate_clicks_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def upsert(self, record):
        self.data[record.click_id] = asdict(record); self._save(); return record

    def get(self, click_id):
        raw = self.data.get(click_id)
        return AffiliateClickRecord(**raw) if raw else None

    def list_by_affiliate(self, affiliate_id):
        return [AffiliateClickRecord(**raw) for raw in self.data.values() if raw.get("affiliate_id")==affiliate_id]

    def list_by_session(self, click_session_id):
        return [AffiliateClickRecord(**raw) for raw in self.data.values() if raw.get("click_session_id")==click_session_id]

class AffiliateClickTracker:
    def __init__(self, store=None):
        self.store = store or AffiliateClickStore()

    def track_click(self, payload, *, link_record=None, attribution_model="last_touch"):
        required = ["affiliate_id","referral_code","source_platform","landing_path","visitor_id","timestamp"]
        errors = [f"missing:{f}" for f in required if not str(payload.get(f,"")).strip()]
        if errors: return {"status":"error","errors":errors}
        click_id = f"clk_{uuid.uuid4().hex[:10]}"
        session_id = str(payload.get("click_session_id","")).strip() or f"cs_{uuid.uuid4().hex[:10]}"
        is_active = bool(link_record.get("is_active", True)) if link_record else True
        record = AffiliateClickRecord(
            click_id=click_id, click_session_id=session_id,
            affiliate_id=payload["affiliate_id"], referral_code=payload["referral_code"],
            campaign_id=payload.get("campaign_id"), tenant_id=payload.get("tenant_id"),
            source_platform=payload["source_platform"], source_type=payload.get("source_type"),
            landing_path=payload["landing_path"], visitor_id=payload["visitor_id"],
            ip_address=payload.get("ip_address"), user_agent=payload.get("user_agent"),
            is_active_link=is_active, linked_lead_id=None, linked_booking_id=None,
            linked_revenue=0.0, attribution_model=attribution_model, timestamp=payload["timestamp"]
        )
        self.store.upsert(record)
        return {"status":"ok","click":asdict(record)}

    def attach_lead(self, click_id, lead_id):
        record = self.store.get(click_id)
        if not record: return {"status":"error","errors":[f"not_found:{click_id}"]}
        record.linked_lead_id = lead_id; self.store.upsert(record)
        return {"status":"ok","click":asdict(record)}

    def attach_booking(self, click_id, booking_id, revenue):
        record = self.store.get(click_id)
        if not record: return {"status":"error","errors":[f"not_found:{click_id}"]}
        record.linked_booking_id = booking_id; record.linked_revenue = float(revenue)
        self.store.upsert(record)
        return {"status":"ok","click":asdict(record)}

    def resolve_attribution_click(self, click_session_id, *, model="last_touch"):
        clicks = self.store.list_by_session(click_session_id)
        if not clicks: return {"status":"error","errors":[f"session_not_found:{click_session_id}"]}
        selected = clicks[0] if model == "first_touch" else clicks[-1]
        return {"status":"ok","selected_click":asdict(selected),"all_clicks":[asdict(x) for x in clicks]}
