from __future__ import annotations
from typing import Any, Dict, Optional
from api_access_guard import api_guard
from role_manager import assign_role, revoke_role, list_user_role_assignments
from audit_logger import log_action

def _safe_dict(value): return value if isinstance(value, dict) else {}

def api_assign_role(token, payload):
    payload = _safe_dict(payload)
    guard = api_guard(token=token, action="role.assign", resource_scope="tenant", resource_context={"tenant_id":payload.get("tenant_id"),"clinic_id":payload.get("clinic_id"),"branch_id":payload.get("branch_id")})
    if not guard["allow"]: return guard
    result = assign_role(user_id=payload.get("user_id"), role_name=payload.get("role_name"), assigned_by=guard.get("user_id"), partner_id=payload.get("partner_id"), tenant_id=payload.get("tenant_id"), clinic_id=payload.get("clinic_id"), branch_id=payload.get("branch_id"), metadata=payload.get("metadata"))
    log_action(user_id=guard.get("user_id"), action="assign_role", resource="user_role", resource_id=result.get("assignment",{}).get("user_role_id") if result.get("assignment") else None, tenant_id=payload.get("tenant_id"), clinic_id=payload.get("clinic_id"), metadata={"target_user":payload.get("user_id"),"role":payload.get("role_name"),"result":result.get("success")})
    return result

def api_revoke_role(token, payload):
    payload = _safe_dict(payload)
    guard = api_guard(token=token, action="role.revoke", resource_scope="tenant", resource_context={"tenant_id":payload.get("tenant_id")})
    if not guard["allow"]: return guard
    result = revoke_role(user_role_id=payload.get("user_role_id"), revoked_by=guard.get("user_id"))
    log_action(user_id=guard.get("user_id"), action="revoke_role", resource="user_role", resource_id=payload.get("user_role_id"), tenant_id=payload.get("tenant_id"), metadata={"result":result.get("success")})
    return result

def api_list_user_roles(token, payload):
    payload = _safe_dict(payload)
    guard = api_guard(token=token, action="user.list", resource_scope="tenant", resource_context={"tenant_id":payload.get("tenant_id")})
    if not guard["allow"]: return guard
    data = list_user_role_assignments(user_id=payload.get("user_id"), tenant_id=payload.get("tenant_id"), clinic_id=payload.get("clinic_id"), branch_id=payload.get("branch_id"))
    log_action(user_id=guard.get("user_id"), action="list_user_roles", tenant_id=payload.get("tenant_id"), metadata={"count":len(data)})
    return {"success":True,"data":data}

def api_get_audit_logs(token, payload):
    from audit_logger import list_audit_logs
    payload = _safe_dict(payload)
    guard = api_guard(token=token, action="audit.view_logs", resource_scope="tenant", resource_context={"tenant_id":payload.get("tenant_id")})
    if not guard["allow"]: return guard
    logs = list_audit_logs(user_id=payload.get("user_id"), tenant_id=payload.get("tenant_id"), clinic_id=payload.get("clinic_id"))
    return {"success":True,"logs":logs}

def api_invite_user(token, payload):
    payload = _safe_dict(payload)
    guard = api_guard(token=token, action="user.invite", resource_scope="tenant", resource_context={"tenant_id":payload.get("tenant_id")})
    if not guard["allow"]: return guard
    user_id = f"user_{payload.get('email')}"
    log_action(user_id=guard.get("user_id"), action="invite_user", tenant_id=payload.get("tenant_id"), metadata={"email":payload.get("email")})
    return {"success":True,"user_id":user_id,"message":"invite sent"}

def validate_admin_api_response(result):
    errors = []
    if "success" not in result and "allow" not in result: errors.append("missing success/allow")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== ROLE ADMIN API TEST ===")
    token = "token_abc"
    assign_case = api_assign_role(token, {"user_id":"u_002","role_name":"branch_manager","tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001"})
    print("ASSIGN:", assign_case)
    list_case = api_list_user_roles(token, {"tenant_id":"t_001"})
    print("LIST:", list_case)
    if assign_case.get("assignment"):
        revoke_case = api_revoke_role(token, {"user_role_id":assign_case["assignment"]["user_role_id"],"tenant_id":"t_001"})
        print("REVOKE:", revoke_case)
