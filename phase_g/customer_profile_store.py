
from __future__ import annotations
import json
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class CustomerProfile:
    customer_id: str
    tenant_id: str
    clinic_id: str
    branch_id: str
    external_user_id: str
    first_source_platform: str
    first_source_type: str
    source_history: List[Dict[str, Any]] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    latest_lead_score: int = 0
    latest_lead_level: str = "cold"
    recommendation_history: List[Dict[str, Any]] = field(default_factory=list)
    booking_history: List[Dict[str, Any]] = field(default_factory=list)
    first_seen_at: Optional[str] = None
    last_seen_at: Optional[str] = None
    last_message_text: Optional[str] = None

class CustomerProfileStore:
    def __init__(self, storage_file: str = "customer_profiles_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_profile(self, customer_id: str) -> Optional[CustomerProfile]:
        raw = self.data.get(customer_id)
        if not raw: return None
        return CustomerProfile(**raw)

    def upsert_from_intake(self, intake_result) -> CustomerProfile:
        customer = intake_result["customer"]
        event = intake_result["canonical_event"]
        customer_id = customer["customer_id"]
        existing = self.get_profile(customer_id)
        if existing:
            profile = existing
        else:
            profile = CustomerProfile(
                customer_id=customer_id, tenant_id=customer["tenant_id"],
                clinic_id=customer["clinic_id"], branch_id=customer["branch_id"],
                external_user_id=customer["external_user_id"],
                first_source_platform=customer["source_platform"],
                first_source_type=customer["first_source_type"],
                first_seen_at=event.get("timestamp")
            )
        profile.last_seen_at = event.get("timestamp")
        profile.last_message_text = event.get("message_text")
        profile.source_history.append({"timestamp": event.get("timestamp"), "source_platform": event.get("source_platform"), "source_type": event.get("source_type"), "campaign_id": event.get("campaign_id"), "affiliate_id": event.get("affiliate_id")})
        self.data[customer_id] = asdict(profile)
        self._save()
        return profile

    def update_lead_score(self, customer_id, score, level):
        profile = self.get_profile(customer_id)
        if not profile: raise ValueError(f"not_found:{customer_id}")
        profile.latest_lead_score = score
        profile.latest_lead_level = level
        self.data[customer_id] = asdict(profile)
        self._save()
        return profile

    def append_recommendation(self, customer_id, recommendation):
        profile = self.get_profile(customer_id)
        if not profile: raise ValueError(f"not_found:{customer_id}")
        profile.recommendation_history.append(recommendation)
        self.data[customer_id] = asdict(profile)
        self._save()
        return profile

    def append_booking(self, customer_id, booking):
        profile = self.get_profile(customer_id)
        if not profile: raise ValueError(f"not_found:{customer_id}")
        profile.booking_history.append(booking)
        self.data[customer_id] = asdict(profile)
        self._save()
        return profile

    def add_tag(self, customer_id, tag):
        profile = self.get_profile(customer_id)
        if not profile: raise ValueError(f"not_found:{customer_id}")
        if tag not in profile.tags: profile.tags.append(tag)
        self.data[customer_id] = asdict(profile)
        self._save()
        return profile

    def get_history_summary(self, customer_id):
        profile = self.get_profile(customer_id)
        if not profile: return {"previous_sessions":0,"previous_bookings":0,"previous_recommendations":0}
        return {"previous_sessions":len(profile.source_history),"previous_bookings":len(profile.booking_history),"previous_recommendations":len(profile.recommendation_history),"latest_lead_score":profile.latest_lead_score,"latest_lead_level":profile.latest_lead_level,"tags":profile.tags}
