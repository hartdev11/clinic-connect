
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class SalesAgentProfile:
    agent_id: str
    tenant_id: str
    clinic_id: str
    branch_id: Optional[str]
    full_name: str
    email: str
    phone: str
    status: str
    role_type: str
    commission_type: str
    commission_value: float
    bonus_rules: List[Dict[str, Any]] = field(default_factory=list)
    assigned_affiliate_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)
    total_leads: int = 0
    total_bookings: int = 0
    total_revenue: float = 0.0
    total_commission_earned: float = 0.0

class SalesAgentStore:
    def __init__(self, storage_file="sales_agents_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def upsert(self, profile):
        self.data[profile.agent_id] = asdict(profile); self._save(); return profile

    def get(self, agent_id):
        raw = self.data.get(agent_id)
        return SalesAgentProfile(**raw) if raw else None

    def get_by_email(self, email):
        for raw in self.data.values():
            if raw.get("email","").lower() == email.lower(): return SalesAgentProfile(**raw)
        return None

class SalesAgentManager:
    def __init__(self, store=None):
        self.store = store or SalesAgentStore()

    def signup(self, payload):
        required = ["tenant_id","clinic_id","full_name","email","phone"]
        errors = [f"missing:{f}" for f in required if not payload.get(f)]
        if payload.get("email") and "@" not in payload["email"]: errors.append("invalid_email")
        if errors: return {"status":"error","errors":errors}
        if self.store.get_by_email(payload["email"]):
            return {"status":"error","errors":[f"email_exists:{payload['email']}"]}
        profile = SalesAgentProfile(
            agent_id=f"agent_{uuid.uuid4().hex[:10]}",
            tenant_id=payload["tenant_id"], clinic_id=payload["clinic_id"],
            branch_id=payload.get("branch_id"), full_name=payload["full_name"].strip(),
            email=payload["email"].strip().lower(), phone=payload["phone"].strip(),
            status="pending", role_type=payload.get("role_type","closer"),
            commission_type=payload.get("commission_type","percent"),
            commission_value=float(payload.get("commission_value",0.0)),
            notes=["agent_created","status=pending"]
        )
        self.store.upsert(profile)
        return {"status":"ok","agent":asdict(profile)}

    def update_status(self, agent_id, new_status, note=None):
        profile = self.store.get(agent_id)
        if not profile: return {"status":"error","errors":[f"not_found:{agent_id}"]}
        profile.status = new_status; profile.notes.append(f"status:{new_status}")
        if note: profile.notes.append(note)
        self.store.upsert(profile)
        return {"status":"ok","agent":asdict(profile)}

    def record_performance(self, agent_id, *, lead_increment=0, booking_increment=0, revenue_increment=0.0):
        profile = self.store.get(agent_id)
        if not profile: return {"status":"error","errors":[f"not_found:{agent_id}"]}
        profile.total_leads += int(lead_increment)
        profile.total_bookings += int(booking_increment)
        profile.total_revenue += float(revenue_increment)
        if profile.commission_type == "fixed":
            profile.total_commission_earned += round(float(booking_increment) * float(profile.commission_value), 2)
        else:
            profile.total_commission_earned += round(float(revenue_increment) * float(profile.commission_value), 2)
        profile.notes.append(f"perf:leads+{lead_increment},bookings+{booking_increment},rev+{revenue_increment}")
        self.store.upsert(profile)
        return {"status":"ok","agent":asdict(profile)}
