from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

AUDIT_LOGS: List[Dict[str, Any]] = []

SENSITIVE_ACTIONS = {"login","logout","assign_role","revoke_role","change_subscription","mark_invoice_paid","refund","connect_integration_channel","rotate_api_key","update_growth_rules","execute_growth_action","override_permission"}
DEFAULT_RETENTION_DAYS = 90

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _generate_audit_id(): return f"audit_{uuid4().hex[:16]}"

def log_action(user_id, action, resource=None, resource_id=None, tenant_id=None, clinic_id=None, branch_id=None, metadata=None, ip_address=None, user_agent=None, status="success"):
    audit_record = {"audit_id":_generate_audit_id(),"user_id":user_id,"action":_normalize_text(action),"resource":_normalize_text(resource),"resource_id":resource_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"metadata":metadata or {},"ip_address":ip_address,"user_agent":user_agent,"status":_normalize_text(status),"is_sensitive":_normalize_text(action) in SENSITIVE_ACTIONS,"created_at":_now_iso()}
    AUDIT_LOGS.append(audit_record)
    return audit_record

def list_audit_logs(user_id=None, tenant_id=None, clinic_id=None, action=None, status=None, limit=100):
    results = []
    for log in reversed(AUDIT_LOGS):
        if user_id and log.get("user_id") != user_id: continue
        if tenant_id and log.get("tenant_id") != tenant_id: continue
        if clinic_id and log.get("clinic_id") != clinic_id: continue
        if action and _normalize_text(log.get("action")) != _normalize_text(action): continue
        if status and _normalize_text(log.get("status")) != _normalize_text(status): continue
        results.append(log)
        if len(results) >= limit: break
    return results

def get_audit_by_id(audit_id):
    for log in AUDIT_LOGS:
        if log.get("audit_id") == audit_id: return log
    return None

def detect_suspicious_activity(user_id, window_size=10):
    recent_logs = list_audit_logs(user_id=user_id, limit=window_size)
    failed_count = sum(1 for x in recent_logs if x.get("status") == "failed")
    return {"user_id":user_id,"recent_actions_checked":window_size,"failed_count":failed_count,"is_suspicious":failed_count >= 5}

def cleanup_old_logs(retention_days=DEFAULT_RETENTION_DAYS):
    now = datetime.utcnow()
    kept = []
    removed = 0
    for log in AUDIT_LOGS:
        created_at = log.get("created_at")
        try:
            dt = datetime.fromisoformat(created_at.replace("Z",""))
            if (now - dt).days > retention_days: removed += 1
            else: kept.append(log)
        except: kept.append(log)
    AUDIT_LOGS.clear()
    AUDIT_LOGS.extend(kept)
    return {"removed":removed,"remaining":len(AUDIT_LOGS),"retention_days":retention_days}

def validate_audit_record(record):
    errors = []
    for field in ["audit_id","user_id","action","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if record.get("status") not in {"success","failed"}: errors.append("invalid status")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== AUDIT LOGGER TEST ===")
    log1 = log_action(user_id="u_001", action="login", tenant_id="t_001", metadata={"method":"password"})
    print("LOG1:", log1)
    print(validate_audit_record(log1))
    log2 = log_action(user_id="u_001", action="change_subscription", tenant_id="t_001", clinic_id="c_001", metadata={"plan":"growth"})
    print("LOG2:", log2)
    log3 = log_action(user_id="u_002", action="mark_invoice_paid", tenant_id="t_001", status="failed")
    print("LOG3:", log3)
    print("LIST:", list_audit_logs(tenant_id="t_001"))
    print("SUSPICIOUS:", detect_suspicious_activity("u_002"))
