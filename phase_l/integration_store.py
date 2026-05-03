
from __future__ import annotations
import json, uuid
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class IntegrationLogRecord:
    log_id: str
    log_type: str
    tenant_id: Optional[str]
    clinic_id: Optional[str]
    branch_id: Optional[str]
    source_platform: Optional[str]
    source_type: Optional[str]
    external_user_id: Optional[str]
    session_id: Optional[str]
    event_id: Optional[str]
    payload: Dict[str, Any]
    status: str
    message: Optional[str]
    timestamp: str

class IntegrationStore:
    def __init__(self, storage_file="integration_logs_store.json"):
        self.storage_file = Path(storage_file)
        self.data: Dict[str, Dict[str, Any]] = self._load()

    def _load(self):
        if not self.storage_file.exists(): return {}
        with open(self.storage_file, "r", encoding="utf-8") as f: return json.load(f)

    def _save(self):
        with open(self.storage_file, "w", encoding="utf-8") as f: json.dump(self.data, f, ensure_ascii=False, indent=2)

    def write_log(self, *, log_type, payload, status, timestamp, message=None, tenant_id=None, clinic_id=None, branch_id=None, source_platform=None, source_type=None, external_user_id=None, session_id=None, event_id=None):
        record = IntegrationLogRecord(
            log_id=f"log_{uuid.uuid4().hex[:10]}", log_type=log_type,
            tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id,
            source_platform=source_platform, source_type=source_type,
            external_user_id=external_user_id, session_id=session_id,
            event_id=event_id, payload=payload, status=status,
            message=message, timestamp=timestamp
        )
        self.data[record.log_id] = asdict(record)
        self._save()
        return asdict(record)

    def get_log(self, log_id): return self.data.get(log_id)
    def list_all(self): return list(self.data.values())
    def list_by_platform(self, p): return [x for x in self.data.values() if x.get("source_platform")==p]
    def list_by_tenant(self, t): return [x for x in self.data.values() if x.get("tenant_id")==t]
    def list_by_clinic(self, t, c): return [x for x in self.data.values() if x.get("tenant_id")==t and x.get("clinic_id")==c]
    def list_by_external_user(self, u): return [x for x in self.data.values() if x.get("external_user_id")==u]
    def list_errors(self): return [x for x in self.data.values() if x.get("status")=="error"]
