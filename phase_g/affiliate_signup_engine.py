
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class AffiliateAccount:
    affiliate_id: str
    tenant_id: str
    role_type: str
    full_name: str
    email: str
    phone: str
    company_name: Optional[str]
    social_handle: Optional[str]
    referral_code: str
    status: str
    payout_method: Optional[str]
    payout_account: Optional[str]
    notes: List[str]

class AffiliateSignupStore:
    def __init__(self, storage_file="affiliate_accounts_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_by_email(self, email):
        for raw in self.data.values():
            if raw.get("email","").lower() == email.lower(): return AffiliateAccount(**raw)
        return None

    def get_by_affiliate_id(self, affiliate_id):
        raw = self.data.get(affiliate_id)
        return AffiliateAccount(**raw) if raw else None

    def upsert(self, account):
        self.data[account.affiliate_id] = asdict(account)
        self._save()
        return account

class AffiliateSignupEngine:
    def __init__(self, store=None):
        self.store = store or AffiliateSignupStore()
        self.allowed_roles = {"affiliate","sales_agent","influencer","partner_referral"}
        self.allowed_payout = {"bank_transfer","promptpay","paypal","none"}

    def signup(self, payload):
        errors = self._validate(payload)
        if errors: return {"status":"error","errors":errors}
        if self.store.get_by_email(payload["email"]):
            return {"status":"error","errors":[f"email_exists:{payload['email']}"]}
        aff_id = f"aff_{uuid.uuid4().hex[:10]}"
        name = payload["full_name"]
        cleaned = "".join(c for c in name.upper() if c.isalnum())
        ref_code = f"{cleaned[:4]}{uuid.uuid4().hex[:6].upper()}"
        account = AffiliateAccount(
            affiliate_id=aff_id, tenant_id=payload["tenant_id"],
            role_type=payload["role_type"], full_name=name.strip(),
            email=payload["email"].strip().lower(), phone=payload["phone"].strip(),
            company_name=payload.get("company_name") or None,
            social_handle=payload.get("social_handle") or None,
            referral_code=ref_code, status="pending",
            payout_method=payload.get("payout_method","none"),
            payout_account=payload.get("payout_account") or None,
            notes=["account_created","status=pending"]
        )
        self.store.upsert(account)
        return {"status":"ok","account":asdict(account)}

    def update_status(self, affiliate_id, new_status, note=None):
        account = self.store.get_by_affiliate_id(affiliate_id)
        if not account: return {"status":"error","errors":[f"not_found:{affiliate_id}"]}
        if new_status not in {"pending","approved","rejected","suspended"}:
            return {"status":"error","errors":[f"invalid_status:{new_status}"]}
        account.status = new_status
        account.notes.append(f"status:{new_status}")
        if note: account.notes.append(note)
        self.store.upsert(account)
        return {"status":"ok","account":asdict(account)}

    def _validate(self, payload):
        errors = []
        for f in ["tenant_id","role_type","full_name","email","phone"]:
            if not payload.get(f): errors.append(f"missing:{f}")
        if payload.get("role_type") and payload["role_type"] not in self.allowed_roles:
            errors.append(f"invalid_role:{payload['role_type']}")
        if payload.get("email") and "@" not in payload["email"]:
            errors.append("invalid_email")
        return errors
