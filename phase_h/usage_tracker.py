from __future__ import annotations
from typing import Dict, Any
from datetime import datetime
import uuid
from wallet_manager import deduct_tokens, can_use_service

USAGE_LOGS = []

def _now():
    return datetime.utcnow().isoformat()

def _generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

def calculate_usage_cost(usage_type, payload):
    if usage_type == "conversation": return 1
    if usage_type == "llm_tokens": return int(payload.get("tokens_used", 0))
    if usage_type == "booking_event": return 2
    return 1

def track_usage(tenant_id, usage_type, payload):
    if not can_use_service(tenant_id): return {"success": False, "reason": "service_blocked_no_balance"}
    cost = calculate_usage_cost(usage_type, payload)
    deduct_result = deduct_tokens(tenant_id=tenant_id, amount=cost, source=usage_type, reference_id=payload.get("ref_id", ""))
    if not deduct_result.get("success"): return {"success": False, "reason": "insufficient_balance"}
    usage_log = {"usage_id": _generate_id("usage"), "tenant_id": tenant_id, "usage_type": usage_type, "cost": cost, "payload": payload, "created_at": _now()}
    USAGE_LOGS.append(usage_log)
    return {"success": True, "cost": cost, "remaining_balance": deduct_result["balance"]}

def get_usage_logs(tenant_id):
    return [u for u in USAGE_LOGS if u["tenant_id"] == tenant_id]

if __name__ == "__main__":
    print("=== USAGE TEST ===")
    tenant = "tenant_001"
    from wallet_manager import add_tokens
    add_tokens(tenant, 100)
    result = track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used": 20})
    print(result)
