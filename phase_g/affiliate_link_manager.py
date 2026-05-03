
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

@dataclass
class AffiliateLinkRecord:
    link_id: str
    affiliate_id: str
    tenant_id: str
    referral_code: str
    campaign_id: Optional[str]
    source_platform: str
    source_type: Optional[str]
    landing_path: str
    full_url: str
    is_active: bool
    tags: List[str]
    notes: List[str]

class AffiliateLinkStore:
    def __init__(self, storage_file="affiliate_links_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def upsert(self, record):
        self.data[record.link_id] = asdict(record)
        self._save()
        return record

    def get(self, link_id):
        raw = self.data.get(link_id)
        return AffiliateLinkRecord(**raw) if raw else None

    def list_by_affiliate(self, affiliate_id):
        return [AffiliateLinkRecord(**raw) for raw in self.data.values() if raw.get("affiliate_id")==affiliate_id]

class AffiliateLinkManager:
    def __init__(self, store=None, base_url="https://app.yourdomain.com"):
        self.store = store or AffiliateLinkStore()
        self.base_url = base_url.rstrip("/")

    def create_link(self, payload):
        required = ["tenant_id","affiliate_id","referral_code","landing_path"]
        errors = [f"missing:{f}" for f in required if not payload.get(f)]
        if errors: return {"status":"error","errors":errors}
        link_id = f"lnk_{uuid.uuid4().hex[:10]}"
        path = payload["landing_path"].strip()
        if not path.startswith("/"): path = "/" + path
        query = {"aff_id":payload["affiliate_id"],"ref":payload["referral_code"],"src":payload.get("source_platform","generic")}
        if payload.get("campaign_id"): query["camp"] = payload["campaign_id"]
        if payload.get("source_type"): query["src_type"] = payload["source_type"]
        full_url = f"{self.base_url}{path}?{urlencode(query)}"
        record = AffiliateLinkRecord(
            link_id=link_id, affiliate_id=payload["affiliate_id"],
            tenant_id=payload["tenant_id"], referral_code=payload["referral_code"],
            campaign_id=payload.get("campaign_id"), source_platform=payload.get("source_platform","generic"),
            source_type=payload.get("source_type"), landing_path=path,
            full_url=full_url, is_active=True, tags=payload.get("tags",[]), notes=["link_created"]
        )
        self.store.upsert(record)
        return {"status":"ok","link":asdict(record)}

    def list_links(self, affiliate_id):
        return {"status":"ok","links":[asdict(x) for x in self.store.list_by_affiliate(affiliate_id)]}

    def deactivate_link(self, link_id, note="deactivated"):
        record = self.store.get(link_id)
        if not record: return {"status":"error","errors":[f"not_found:{link_id}"]}
        record.is_active = False; record.notes.append(note)
        self.store.upsert(record)
        return {"status":"ok","link":asdict(record)}

    def activate_link(self, link_id, note="reactivated"):
        record = self.store.get(link_id)
        if not record: return {"status":"error","errors":[f"not_found:{link_id}"]}
        record.is_active = True; record.notes.append(note)
        self.store.upsert(record)
        return {"status":"ok","link":asdict(record)}
