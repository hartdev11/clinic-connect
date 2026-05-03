from __future__ import annotations
from typing import Any, Dict, List, Optional

USERS: Dict[str, Dict[str, Any]] = {}
USER_ROLES: List[Dict[str, Any]] = []

def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()

def _is_active(status): return _normalize_text(status) == "active"

def get_user(user_id): return USERS.get(user_id)

def get_user_by_email(email):
    target = _normalize_text(email)
    for user in USERS.values():
        if _normalize_text(user.get("email")) == target: return user
    return None

def list_users(tenant_id=None, clinic_id=None, branch_id=None, role=None, status=None):
    results = []
    for user in USERS.values():
        if tenant_id and user.get("tenant_id") != tenant_id: continue
        if clinic_id and user.get("clinic_id") != clinic_id: continue
        if branch_id and user.get("branch_id") != branch_id: continue
        if status and _normalize_text(user.get("status")) != _normalize_text(status): continue
        if role and role not in user.get("assigned_roles", []): continue
        results.append(user)
    return results

def get_user_roles(user_id):
    roles = []
    for ur in USER_ROLES:
        if ur.get("user_id") == user_id and ur.get("status") == "active": roles.append(ur.get("role_id"))
    user = get_user(user_id)
    if user and user.get("primary_role") and user.get("primary_role") not in roles: roles.append(user.get("primary_role"))
    return list(set(roles))

def get_user_role_assignments(user_id):
    return [ur for ur in USER_ROLES if ur.get("user_id") == user_id and ur.get("status") == "active"]

def build_user_scope(user):
    return {"platform":user.get("primary_role") in ["platform_admin","platform_ops"],"partner_id":user.get("partner_id"),"tenant_id":user.get("tenant_id"),"clinic_id":user.get("clinic_id"),"branch_id":user.get("branch_id"),"self_user_id":user.get("user_id")}

def resolve_user_context(user_id):
    user = get_user(user_id)
    if not user: return None
    roles = get_user_roles(user_id)
    scope = build_user_scope(user)
    return {"user":user,"roles":roles,"scope":scope}

def validate_user(user):
    errors = []
    for f in ["user_id","email","tenant_id","status"]:
        if f not in user: errors.append(f"missing {f}")
    if not _is_active(user.get("status")): errors.append("user_not_active")
    return {"valid": len(errors)==0, "errors": errors}

def validate_user_context(ctx):
    errors = []
    if "user" not in ctx: errors.append("missing user")
    if "roles" not in ctx: errors.append("missing roles")
    if "scope" not in ctx: errors.append("missing scope")
    return {"valid": len(errors)==0, "errors": errors}

def seed_demo_users():
    USERS["u_001"] = {"user_id":"u_001","email":"owner@clinic.com","full_name":"Clinic Owner","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":None,"status":"active","primary_role":"clinic_owner","assigned_roles":["clinic_owner"]}
    USERS["u_002"] = {"user_id":"u_002","email":"manager@clinic.com","full_name":"Branch Manager","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","status":"active","primary_role":"branch_manager","assigned_roles":["branch_manager"]}
    USER_ROLES.append({"user_role_id":"ur_001","user_id":"u_002","role_id":"branch_manager","tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","status":"active"})

if __name__ == "__main__":
    print("=== USER DIRECTORY TEST ===")
    seed_demo_users()
    user = get_user("u_001")
    print("USER:", user)
    roles = get_user_roles("u_002")
    print("ROLES:", roles)
    ctx = resolve_user_context("u_002")
    print("CONTEXT:", ctx)
    print("VALID:", validate_user_context(ctx))
