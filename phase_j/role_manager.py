from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

ROLES: Dict[str, Dict[str, Any]] = {}
USER_ROLES: List[Dict[str, Any]] = []

DEFAULT_ROLE_SCOPE_MAP = {
    "platform_admin": "platform", "platform_ops": "platform",
    "partner_admin": "partner",
    "clinic_owner": "clinic", "clinic_admin": "clinic",
    "branch_manager": "branch", "staff": "branch",
    "sales_agent": "self", "affiliate": "self",
    "finance_admin": "tenant", "read_only_analyst": "tenant",
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _generate_user_role_id(): return f"ur_{uuid4().hex[:16]}"

def _expected_scope_fields(scope):
    scope = _normalize_text(scope)
    if scope == "platform": return {"partner_id":False,"tenant_id":False,"clinic_id":False,"branch_id":False}
    if scope == "partner": return {"partner_id":True,"tenant_id":False,"clinic_id":False,"branch_id":False}
    if scope == "tenant": return {"partner_id":False,"tenant_id":True,"clinic_id":False,"branch_id":False}
    if scope == "clinic": return {"partner_id":False,"tenant_id":True,"clinic_id":True,"branch_id":False}
    if scope == "branch": return {"partner_id":False,"tenant_id":True,"clinic_id":True,"branch_id":True}
    if scope == "self": return {"partner_id":False,"tenant_id":True,"clinic_id":False,"branch_id":False}
    return {"partner_id":False,"tenant_id":False,"clinic_id":False,"branch_id":False}

def get_role(role_name): return ROLES.get(_normalize_text(role_name))
def get_role_scope(role_name):
    role = get_role(role_name)
    if role: return role.get("scope")
    return DEFAULT_ROLE_SCOPE_MAP.get(_normalize_text(role_name))
def list_roles(): return list(ROLES.values())

def validate_role_assignment_payload(role_name, partner_id=None, tenant_id=None, clinic_id=None, branch_id=None):
    errors = []
    normalized_role = _normalize_text(role_name)
    scope = get_role_scope(normalized_role)
    if not scope: errors.append("role_not_found"); return {"valid":False,"errors":errors}
    requirements = _expected_scope_fields(scope)
    values = {"partner_id":partner_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id}
    for field, required in requirements.items():
        if required and not values[field]: errors.append(f"{field}_required_for_scope_{scope}")
    if branch_id and not clinic_id: errors.append("clinic_id_required_when_branch_id_present")
    if clinic_id and not tenant_id: errors.append("tenant_id_required_when_clinic_id_present")
    return {"valid":len(errors)==0,"errors":errors,"scope":scope}

def is_duplicate_role_assignment(user_id, role_name, partner_id=None, tenant_id=None, clinic_id=None, branch_id=None):
    for item in USER_ROLES:
        if item.get("status") != "active": continue
        if item.get("user_id") != user_id: continue
        if _normalize_text(item.get("role_name")) != _normalize_text(role_name): continue
        if item.get("partner_id") != partner_id: continue
        if item.get("tenant_id") != tenant_id: continue
        if item.get("clinic_id") != clinic_id: continue
        if item.get("branch_id") != branch_id: continue
        return True
    return False

def assign_role(user_id, role_name, assigned_by=None, partner_id=None, tenant_id=None, clinic_id=None, branch_id=None, metadata=None):
    validation = validate_role_assignment_payload(role_name=role_name, partner_id=partner_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id)
    if not validation["valid"]: return {"success":False,"reason":"invalid_role_assignment_payload","errors":validation["errors"],"assignment":None}
    if is_duplicate_role_assignment(user_id=user_id, role_name=role_name, partner_id=partner_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id):
        return {"success":False,"reason":"duplicate_role_assignment","errors":["duplicate_role_assignment"],"assignment":None}
    assignment = {"user_role_id":_generate_user_role_id(),"user_id":user_id,"role_name":_normalize_text(role_name),"scope":validation["scope"],"partner_id":partner_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"status":"active","assigned_by":assigned_by,"assigned_at":_now_iso(),"revoked_at":None,"revoked_by":None,"revoke_reason":None,"metadata":metadata or {}}
    USER_ROLES.append(assignment)
    return {"success":True,"reason":"ok","errors":[],"assignment":assignment}

def revoke_role(user_role_id, revoked_by=None, revoke_reason="manual_revoke"):
    for item in USER_ROLES:
        if item.get("user_role_id") == user_role_id:
            if item.get("status") != "active": return {"success":False,"reason":"role_assignment_not_active","assignment":item}
            item["status"] = "revoked"
            item["revoked_at"] = _now_iso()
            item["revoked_by"] = revoked_by
            item["revoke_reason"] = revoke_reason
            return {"success":True,"reason":"ok","assignment":item}
    return {"success":False,"reason":"role_assignment_not_found","assignment":None}

def list_user_role_assignments(user_id=None, tenant_id=None, clinic_id=None, branch_id=None, status=None):
    results = []
    for item in USER_ROLES:
        if user_id and item.get("user_id") != user_id: continue
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if branch_id and item.get("branch_id") != branch_id: continue
        if status and _normalize_text(item.get("status")) != _normalize_text(status): continue
        results.append(item)
    return results

def get_active_roles_for_user(user_id):
    roles = []
    for item in USER_ROLES:
        if item.get("user_id") == user_id and item.get("status") == "active": roles.append(item.get("role_name"))
    return list(set(roles))

def seed_default_roles():
    for role_name, scope in DEFAULT_ROLE_SCOPE_MAP.items():
        ROLES[_normalize_text(role_name)] = {"role_id":f"r_{_normalize_text(role_name)}","name":_normalize_text(role_name),"scope":scope,"is_system":True,"is_assignable":True}

def validate_role_assignment_object(item):
    errors = []
    for field in ["user_role_id","user_id","role_name","scope","status","assigned_at"]:
        if field not in item: errors.append(f"missing {field}")
    if item.get("status") not in {"active","revoked"}: errors.append("invalid status")
    if not item.get("role_name"): errors.append("empty role_name")
    if not item.get("scope"): errors.append("empty scope")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== ROLE MANAGER TEST ===")
    seed_default_roles()
    r1 = assign_role(user_id="u_001", role_name="clinic_owner", assigned_by="u_admin", tenant_id="t_001", clinic_id="c_001")
    print("ASSIGN 1:", r1)
    if r1["assignment"]: print("VALID:", validate_role_assignment_object(r1["assignment"]))
    r2 = assign_role(user_id="u_002", role_name="branch_manager", assigned_by="u_admin", tenant_id="t_001", clinic_id="c_001", branch_id="b_001")
    print("ASSIGN 2:", r2)
    dup = assign_role(user_id="u_002", role_name="branch_manager", assigned_by="u_admin", tenant_id="t_001", clinic_id="c_001", branch_id="b_001")
    print("DUP:", dup)
    print("LIST ACTIVE:", list_user_role_assignments(status="active"))
    print("ACTIVE ROLES U002:", get_active_roles_for_user("u_002"))
    if r2["assignment"]:
        revoked = revoke_role(r2["assignment"]["user_role_id"], revoked_by="u_admin")
        print("REVOKED:", revoked)
