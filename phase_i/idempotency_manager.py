from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from hashlib import sha256
from typing import Any, Dict, Optional

IDEMPOTENCY_STORE: Dict[str, Dict[str, Any]] = {}
IDEMPOTENCY_STATUSES = {"pending","completed","failed"}

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _normalize_value(value):
    if value is None: return ""
    if isinstance(value, (dict,list,tuple,set)): return str(value)
    return str(value).strip()

def build_idempotency_key(tenant_id, action, resource_id=None, fingerprint=None):
    if not tenant_id: raise ValueError("tenant_id is required")
    if not action: raise ValueError("action is required")
    parts = [f"tenant:{_normalize_value(tenant_id)}", f"action:{_normalize_value(action)}", f"resource:{_normalize_value(resource_id)}"]
    for key in sorted((fingerprint or {}).keys()):
        parts.append(f"{key}:{_normalize_value(fingerprint[key])}")
    raw = "|".join(parts)
    digest = sha256(raw.encode("utf-8")).hexdigest()[:24]
    return f"idem_{digest}"

def create_idempotency_record(tenant_id, action, resource_id=None, fingerprint=None, metadata=None):
    key = build_idempotency_key(tenant_id=tenant_id, action=action, resource_id=resource_id, fingerprint=fingerprint)
    now = _now_iso()
    record = {"idempotency_key":key,"tenant_id":tenant_id,"action":action,"resource_id":resource_id,"fingerprint":deepcopy(fingerprint or {}),"status":"pending","response_payload":None,"error_message":None,"metadata":deepcopy(metadata or {}),"created_at":now,"updated_at":now}
    IDEMPOTENCY_STORE[key] = deepcopy(record)
    return record

def get_idempotency_record(idempotency_key):
    record = IDEMPOTENCY_STORE.get(idempotency_key)
    return deepcopy(record) if record else None

def mark_idempotency_completed(idempotency_key, response_payload):
    record = IDEMPOTENCY_STORE.get(idempotency_key)
    if not record: raise ValueError("idempotency record not found")
    record["status"] = "completed"
    record["response_payload"] = deepcopy(response_payload)
    record["error_message"] = None
    record["updated_at"] = _now_iso()
    IDEMPOTENCY_STORE[idempotency_key] = deepcopy(record)
    return deepcopy(record)

def mark_idempotency_failed(idempotency_key, error_message):
    if not error_message: raise ValueError("error_message is required")
    record = IDEMPOTENCY_STORE.get(idempotency_key)
    if not record: raise ValueError("idempotency record not found")
    record["status"] = "failed"
    record["error_message"] = error_message
    record["updated_at"] = _now_iso()
    IDEMPOTENCY_STORE[idempotency_key] = deepcopy(record)
    return deepcopy(record)

def begin_or_reuse(tenant_id, action, resource_id=None, fingerprint=None):
    key = build_idempotency_key(tenant_id=tenant_id, action=action, resource_id=resource_id, fingerprint=fingerprint)
    existing = IDEMPOTENCY_STORE.get(key)
    if existing:
        if existing["status"] == "completed": return {"mode":"reuse_completed","idempotency_key":key,"record":deepcopy(existing),"response_payload":deepcopy(existing.get("response_payload"))}
        if existing["status"] == "pending": return {"mode":"reuse_pending","idempotency_key":key,"record":deepcopy(existing),"response_payload":None}
        if existing["status"] == "failed":
            existing["status"] = "pending"
            existing["error_message"] = None
            existing["updated_at"] = _now_iso()
            IDEMPOTENCY_STORE[key] = deepcopy(existing)
            return {"mode":"retry_failed","idempotency_key":key,"record":deepcopy(existing),"response_payload":None}
    created = create_idempotency_record(tenant_id=tenant_id, action=action, resource_id=resource_id, fingerprint=fingerprint)
    return {"mode":"created_new","idempotency_key":key,"record":deepcopy(created),"response_payload":None}

def resolve_idempotent_execution(tenant_id, action, handler, resource_id=None, fingerprint=None):
    begin = begin_or_reuse(tenant_id=tenant_id, action=action, resource_id=resource_id, fingerprint=fingerprint)
    mode = begin["mode"]
    key = begin["idempotency_key"]
    if mode == "reuse_completed": return {"success":True,"reused":True,"idempotency_key":key,"payload":begin["response_payload"]}
    if mode == "reuse_pending": return {"success":False,"reused":True,"idempotency_key":key,"reason":"request_already_in_progress"}
    try:
        payload = handler()
        mark_idempotency_completed(key, payload)
        return {"success":True,"reused":False,"idempotency_key":key,"payload":payload}
    except Exception as e:
        mark_idempotency_failed(key, str(e))
        return {"success":False,"reused":False,"idempotency_key":key,"reason":str(e)}

def validate_idempotency_record(record):
    errors = []
    required = ["idempotency_key","tenant_id","action","status","fingerprint","metadata","created_at","updated_at"]
    for field in required:
        if field not in record: errors.append(f"missing field: {field}")
    if record.get("status") not in IDEMPOTENCY_STATUSES: errors.append("invalid status")
    if not isinstance(record.get("fingerprint",{}), dict): errors.append("fingerprint must be a dict")
    if not isinstance(record.get("metadata",{}), dict): errors.append("metadata must be a dict")
    if record.get("response_payload") is not None and not isinstance(record.get("response_payload"), dict): errors.append("response_payload must be dict or None")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== IDEMPOTENCY MANAGER TEST ===")
    def fake_handler(): return {"order_id":"topup_001","status":"paid"}
    first = resolve_idempotent_execution(tenant_id="tenant_001", action="topup_purchase", resource_id="small_pack", fingerprint={"pack_id":"small","promotion_id":"first_topup_bonus_20"}, handler=fake_handler)
    print("FIRST:", first)
    second = resolve_idempotent_execution(tenant_id="tenant_001", action="topup_purchase", resource_id="small_pack", fingerprint={"pack_id":"small","promotion_id":"first_topup_bonus_20"}, handler=fake_handler)
    print("SECOND:", second)
    record = get_idempotency_record(first["idempotency_key"])
    print("VALIDATION:", validate_idempotency_record(record))
