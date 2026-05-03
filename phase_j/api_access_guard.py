from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional
from permission_engine import check_permission
from tenant_scope_guard import enforce_tenant_scope_guard

SESSIONS = {
    "token_abc": {
        "user_id": "u_001",
        "roles": ["clinic_owner"],
        "partner_id": None,
        "tenant_id": "t_001",
        "clinic_id": "c_001",
        "branch_id": None,
        "status": "active",
    }
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _safe_dict(value): return value if isinstance(value, dict) else {}

def validate_session(token):
    session = SESSIONS.get(token)
    if not session: return {"valid":False,"reason":"session_not_found"}
    if session.get("status") != "active": return {"valid":False,"reason":"session_not_active"}
    return {"valid":True,"session":session}

def build_auth_context(session):
    return {"user_id":session.get("user_id"),"assigned_roles":session.get("roles",[]),"partner_id":session.get("partner_id"),"tenant_id":session.get("tenant_id"),"clinic_id":session.get("clinic_id"),"branch_id":session.get("branch_id")}

def resolve_user_scope(auth_context):
    roles = auth_context.get("assigned_roles", [])
    if "platform_admin" in roles: return "platform"
    if "partner_admin" in roles: return "partner"
    if "finance_admin" in roles: return "tenant"
    if "clinic_owner" in roles or "clinic_admin" in roles: return "clinic"
    if "branch_manager" in roles or "staff" in roles: return "branch"
    if "affiliate" in roles or "sales_agent" in roles: return "self"
    return "self"

def audit_log_stub(payload): print("AUDIT LOG:", payload)

def api_guard(token, action, resource_scope, resource_context=None, request_metadata=None):
    resource_context = _safe_dict(resource_context)
    request_metadata = _safe_dict(request_metadata)
    session_check = validate_session(token)
    if not session_check["valid"]: return {"allow":False,"stage":"auth","reason":session_check["reason"],"evaluated_at":_now_iso()}
    session = session_check["session"]
    auth_context = build_auth_context(session)
    perm_result = check_permission(auth_context=auth_context, action=action, resource_context=resource_context)
    if not perm_result["allow"]:
        audit_log_stub({"type":"access_denied","stage":"permission","user_id":auth_context.get("user_id"),"action":action,"reason":perm_result["reason"],"timestamp":_now_iso()})
        return {"allow":False,"stage":"permission","reason":perm_result["reason"],"evaluated_at":_now_iso()}
    user_scope = resolve_user_scope(auth_context)
    scope_result = enforce_tenant_scope_guard(auth_context=auth_context, user_scope=user_scope, resource_scope=resource_scope, resource_context=resource_context)
    if not scope_result["allow"]:
        audit_log_stub({"type":"access_denied","stage":"tenant_scope","user_id":auth_context.get("user_id"),"action":action,"reason":scope_result["reason"],"timestamp":_now_iso()})
        return {"allow":False,"stage":"tenant_scope","reason":scope_result["reason"],"evaluated_at":_now_iso()}
    audit_log_stub({"type":"access_granted","user_id":auth_context.get("user_id"),"action":action,"resource_scope":resource_scope,"resource_context":resource_context,"timestamp":_now_iso()})
    return {"allow":True,"stage":"ok","user_id":auth_context.get("user_id"),"action":action,"resource_scope":resource_scope,"evaluated_at":_now_iso()}

def validate_api_guard_result(result):
    errors = []
    if "allow" not in result: errors.append("missing allow")
    if not isinstance(result.get("allow"), bool): errors.append("allow must be bool")
    if "evaluated_at" not in result: errors.append("missing evaluated_at")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== API ACCESS GUARD TEST ===")
    token = "token_abc"
    case_1 = api_guard(token=token, action="billing.manage_subscription", resource_scope="clinic", resource_context={"tenant_id":"t_001","clinic_id":"c_001"})
    print("CASE 1:", case_1)
    case_2 = api_guard(token=token, action="billing.mark_paid", resource_scope="tenant", resource_context={"tenant_id":"t_999"})
    print("CASE 2:", case_2)
