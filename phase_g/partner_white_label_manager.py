
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class WhiteLabelPartner:
    partner_id: str
    tenant_id: str
    company_name: str
    owner_name: str
    email: str
    phone: str
    status: str
    white_label_enabled: bool
    brand_name: str
    logo_url: Optional[str]
    primary_color: Optional[str]
    secondary_color: Optional[str]
    custom_domain: Optional[str]
    support_email: Optional[str]
    support_phone: Optional[str]
    feature_flags: Dict[str, Any] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)

class WhiteLabelPartnerStore:
    def __init__(self, storage_file="white_label_partners_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def upsert(self, partner):
        self.data[partner.partner_id] = asdict(partner); self._save(); return partner

    def get(self, partner_id):
        raw = self.data.get(partner_id)
        return WhiteLabelPartner(**raw) if raw else None

    def get_by_email(self, email):
        for raw in self.data.values():
            if raw.get("email","").lower() == email.lower(): return WhiteLabelPartner(**raw)
        return None

class PartnerWhiteLabelManager:
    def __init__(self, store=None):
        self.store = store or WhiteLabelPartnerStore()

    def signup_partner(self, payload):
        required = ["company_name","owner_name","email","phone"]
        errors = [f"missing:{f}" for f in required if not payload.get(f)]
        if payload.get("email") and "@" not in payload["email"]: errors.append("invalid_email")
        if errors: return {"status":"error","errors":errors}
        if self.store.get_by_email(payload["email"]):
            return {"status":"error","errors":[f"email_exists:{payload['email']}"]}
        partner = WhiteLabelPartner(
            partner_id=f"partner_{uuid.uuid4().hex[:10]}",
            tenant_id=payload.get("tenant_id") or f"tenant_{uuid.uuid4().hex[:10]}",
            company_name=payload["company_name"].strip(),
            owner_name=payload["owner_name"].strip(),
            email=payload["email"].strip().lower(),
            phone=payload["phone"].strip(),
            status="pending",
            white_label_enabled=bool(payload.get("white_label_enabled", True)),
            brand_name=(payload.get("brand_name") or payload["company_name"]).strip(),
            logo_url=payload.get("logo_url") or None,
            primary_color=payload.get("primary_color") or None,
            secondary_color=payload.get("secondary_color") or None,
            custom_domain=payload.get("custom_domain") or None,
            support_email=payload.get("support_email") or None,
            support_phone=payload.get("support_phone") or None,
            feature_flags=payload.get("feature_flags", {}),
            notes=["partner_created","status=pending"]
        )
        self.store.upsert(partner)
        return {"status":"ok","partner":asdict(partner)}

    def update_status(self, partner_id, new_status, note=None):
        partner = self.store.get(partner_id)
        if not partner: return {"status":"error","errors":[f"not_found:{partner_id}"]}
        partner.status = new_status; partner.notes.append(f"status:{new_status}")
        if note: partner.notes.append(note)
        self.store.upsert(partner)
        return {"status":"ok","partner":asdict(partner)}

    def update_branding(self, partner_id, *, brand_name=None, logo_url=None, primary_color=None, secondary_color=None, support_email=None, support_phone=None):
        partner = self.store.get(partner_id)
        if not partner: return {"status":"error","errors":[f"not_found:{partner_id}"]}
        if brand_name: partner.brand_name = brand_name.strip()
        if logo_url is not None: partner.logo_url = logo_url or None
        if primary_color is not None: partner.primary_color = primary_color or None
        if secondary_color is not None: partner.secondary_color = secondary_color or None
        if support_email is not None: partner.support_email = support_email or None
        if support_phone is not None: partner.support_phone = support_phone or None
        partner.notes.append("branding_updated")
        self.store.upsert(partner)
        return {"status":"ok","partner":asdict(partner)}

    def update_custom_domain(self, partner_id, custom_domain):
        partner = self.store.get(partner_id)
        if not partner: return {"status":"error","errors":[f"not_found:{partner_id}"]}
        partner.custom_domain = custom_domain.strip().lower()
        partner.notes.append("domain_updated")
        self.store.upsert(partner)
        return {"status":"ok","partner":asdict(partner)}

    def update_feature_flags(self, partner_id, feature_flags):
        partner = self.store.get(partner_id)
        if not partner: return {"status":"error","errors":[f"not_found:{partner_id}"]}
        partner.feature_flags.update(feature_flags)
        partner.notes.append("flags_updated")
        self.store.upsert(partner)
        return {"status":"ok","partner":asdict(partner)}

    def get_runtime_branding_context(self, partner_id):
        partner = self.store.get(partner_id)
        if not partner: return {"status":"error","errors":[f"not_found:{partner_id}"]}
        return {"status":"ok","branding_context":{"partner_id":partner.partner_id,"tenant_id":partner.tenant_id,"brand_name":partner.brand_name,"logo_url":partner.logo_url,"primary_color":partner.primary_color,"secondary_color":partner.secondary_color,"custom_domain":partner.custom_domain,"support_email":partner.support_email,"support_phone":partner.support_phone,"white_label_enabled":partner.white_label_enabled,"feature_flags":partner.feature_flags,"status":partner.status}}
