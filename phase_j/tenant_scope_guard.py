from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _safe_dict(value): return value if isinstance(value, dict) else {}

def _match_partner(auth_context, resource_context): return _normalize_text(auth_context.get("partner_id")) == _normalize_text(resource_context.get("partner_id"))
def _match_tenant(auth_context, resource_context): return _normalize_text(auth_context.get("tenant_id")) == _normalize_text(resource_context.get("tenant_id"))
def _match_clinic(auth_context, resource_context): return _normalize_text(auth_context.get("clinic_id")) == _normalize_text(resource_context.get("clinic_id"))
def _match_branch(auth_context, resource_context): return _normalize_text(auth_context.get("branch_id")) == _normalize_text(resource_context.get("branch_id"))
def _match_self(auth_context, resource_context):
    target_user_id = resource_context.get("user_id") or resource_context.get("owner_user_id") or resource_context.get("affiliate_user_id") or resource_context.get("agent_user_id")
    return _normalize_text(auth_context.get("user_id")) == _normalize_text(target_user_id)

def guard_platform_scope(auth_context, resource_context): return {"allow":True,"reason":"platform_scope_allowed","matched_scope":"platform","evaluated_at":_now_iso()}

def guard_partner_scope(auth_context, resource_context):
    if _match_partner(auth_context, resource_context): return {"allow":True,"reason":"partner_scope_match","matched_scope":"partner","evaluated_at":_now_iso()}
    return {"allow":False,"reason":"partner_scope_mismatch","matched_scope":"partner","evaluated_at":_now_iso()}

def guard_tenant_scope(auth_context, resource_context):
    if _match_tenant(auth_context, resource_context): return {"allow":True,"reason":"tenant_scope_match","matched_scope":"tenant","evaluated_at":_now_iso()}
    return {"allow":False,"reason":"tenant_scope_mismatch","matched_scope":"tenant","evaluated_at":_now_iso()}

def guard_clinic_scope(auth_context, resource_context):
    if _match_clinic(auth_context, resource_context): return {"allow":True,"reason":"clinic_scope_match","matched_scope":"clinic","evaluated_at":_now_iso()}
    return {"allow":False,"reason":"clinic_scope_mismatch","matched_scope":"clinic","evaluated_at":_now_iso()}

def guard_branch_scope(auth_context, resource_context):
    if _match_branch(auth_context, resource_context): return {"allow":True,"reason":"branch_scope_match","matched_scope":"branch","evaluated_at":_now_iso()}
    return {"allow":False,"reason":"branch_scope_mismatch","matched_scope":"branch","evaluated_at":_now_iso()}

def guard_self_scope(auth_context, resource_context):
    if _match_self(auth_context, resource_context): return {"allow":True,"reason":"self_scope_match","matched_scope":"self","evaluated_at":_now_iso()}
    return {"allow":False,"reason":"self_scope_mismatch","matched_scope":"self","evaluated_at":_now_iso()}

def guard_hierarchical_scope(user_scope, auth_context, resource_scope, resource_context=None):
    resource_context = _safe_dict(resource_context)
    user_scope = _normalize_text(user_scope)
    resource_scope = _normalize_text(resource_scope)
    if user_scope == "platform": return guard_platform_scope(auth_context, resource_context)
    if user_scope == "partner":
        if resource_scope in {"partner","tenant","clinic","branch","self"}: return guard_partner_scope(auth_context, resource_context)
    if user_scope == "tenant":
        if resource_scope in {"tenant","clinic","branch"}: return guard_tenant_scope(auth_context, resource_context)
        return {"allow":False,"reason":"tenant_scope_cannot_access_requested_scope","matched_scope":user_scope,"evaluated_at":_now_iso()}
    if user_scope == "clinic":
        if resource_scope == "clinic": return guard_clinic_scope(auth_context, resource_context)
        if resource_scope == "branch":
            if _match_clinic(auth_context, resource_context): return {"allow":True,"reason":"clinic_to_branch_scope_match","matched_scope":"clinic","evaluated_at":_now_iso()}
            return {"allow":False,"reason":"clinic_to_branch_scope_mismatch","matched_scope":"clinic","evaluated_at":_now_iso()}
        if resource_scope == "self": return guard_self_scope(auth_context, resource_context)
        return {"allow":False,"reason":"clinic_scope_cannot_access_requested_scope","matched_scope":user_scope,"evaluated_at":_now_iso()}
    if user_scope == "branch":
        if resource_scope == "branch": return guard_branch_scope(auth_context, resource_context)
        if resource_scope == "self": return guard_self_scope(auth_context, resource_context)
        return {"allow":False,"reason":"branch_scope_cannot_access_requested_scope","matched_scope":user_scope,"evaluated_at":_now_iso()}
    if user_scope == "self":
        if resource_scope == "self": return guard_self_scope(auth_context, resource_context)
        return {"allow":False,"reason":"self_scope_cannot_access_requested_scope","matched_scope":user_scope,"evaluated_at":_now_iso()}
    return {"allow":False,"reason":"unsupported_user_scope","matched_scope":user_scope,"evaluated_at":_now_iso()}

def validate_resource_scope_consistency(resource_scope, resource_context=None):
    resource_context = _safe_dict(resource_context)
    resource_scope = _normalize_text(resource_scope)
    errors = []
    if resource_scope == "partner":
        if not resource_context.get("partner_id"): errors.append("partner_id_required")
    elif resource_scope == "tenant":
        if not resource_context.get("tenant_id"): errors.append("tenant_id_required")
    elif resource_scope == "clinic":
        if not resource_context.get("tenant_id"): errors.append("tenant_id_required")
        if not resource_context.get("clinic_id"): errors.append("clinic_id_required")
    elif resource_scope == "branch":
        if not resource_context.get("tenant_id"): errors.append("tenant_id_required")
        if not resource_context.get("clinic_id"): errors.append("clinic_id_required")
        if not resource_context.get("branch_id"): errors.append("branch_id_required")
    elif resource_scope == "self":
        if not (resource_context.get("user_id") or resource_context.get("owner_user_id") or resource_context.get("affiliate_user_id") or resource_context.get("agent_user_id")):
            errors.append("self_target_user_id_required")
    return {"valid":len(errors)==0,"errors":errors}

def enforce_tenant_scope_guard(auth_context, user_scope, resource_scope, resource_context=None):
    resource_context = _safe_dict(resource_context)
    consistency = validate_resource_scope_consistency(resource_scope=resource_scope, resource_context=resource_context)
    if not consistency["valid"]: return {"allow":False,"reason":f"invalid_resource_context:{','.join(consistency['errors'])}","matched_scope":None,"evaluated_at":_now_iso()}
    return guard_hierarchical_scope(user_scope=user_scope, auth_context=auth_context, resource_scope=resource_scope, resource_context=resource_context)

def validate_scope_guard_result(result):
    errors = []
    for field in ["allow","reason","matched_scope","evaluated_at"]:
        if field not in result: errors.append(f"missing {field}")
    if not isinstance(result.get("allow"), bool): errors.append("allow must be bool")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== TENANT SCOPE GUARD TEST ===")
    clinic_owner_ctx = {"user_id":"u_001","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":None}
    case_1 = enforce_tenant_scope_guard(auth_context=clinic_owner_ctx, user_scope="clinic", resource_scope="branch", resource_context={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_002"})
    print("CASE 1:", case_1)
    case_2 = enforce_tenant_scope_guard(auth_context=clinic_owner_ctx, user_scope="clinic", resource_scope="clinic", resource_context={"tenant_id":"t_001","clinic_id":"c_999"})
    print("CASE 2:", case_2)
