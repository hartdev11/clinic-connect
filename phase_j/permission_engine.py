from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

ROLE_PERMISSION_MAP: Dict[str, List[str]] = {
    "platform_admin": ["*"],
    "platform_ops": ["dashboard.view_platform","dashboard.view_partner","dashboard.view_clinic","dashboard.view_branch","dashboard.view_affiliate","dashboard.view_agent","dashboard.view_finance","billing.view_invoice","billing.view_payment","growth.view_summary","growth.view_funnel","growth.view_snapshot","cost.view_summary","cost.view_trend","cost.view_token_usage","integration.view_logs","crm.view_customer","crm.view_lead","sales.view_booking","sales.view_opportunity","sales.view_performance","affiliate.view_commission","audit.view_logs"],
    "partner_admin": ["user.invite","user.view","user.list","role.assign","role.revoke","role.view_matrix","dashboard.view_partner","dashboard.view_clinic","dashboard.view_branch","billing.view_invoice","billing.view_payment","growth.view_summary","growth.view_funnel","growth.view_snapshot","cost.view_summary","cost.view_trend","integration.manage_channel","integration.view_logs","audit.view_logs"],
    "clinic_owner": ["user.invite","user.view","user.list","role.assign","role.revoke","role.view_matrix","dashboard.view_clinic","dashboard.view_branch","dashboard.view_affiliate","dashboard.view_agent","dashboard.view_finance","billing.view_invoice","billing.view_payment","billing.manage_subscription","billing.mark_paid","growth.view_summary","growth.view_funnel","growth.view_snapshot","growth.manage_rules","growth.execute_action","cost.view_summary","cost.view_trend","cost.view_token_usage","integration.manage_channel","integration.view_logs","crm.view_customer","crm.view_lead","sales.view_booking","sales.view_opportunity","sales.view_performance","audit.view_logs","approval.promotion","approval.billing_adjustment","approval.integration_rotation"],
    "clinic_admin": ["user.view","user.list","dashboard.view_clinic","dashboard.view_branch","growth.view_summary","growth.view_funnel","growth.view_snapshot","crm.view_customer","crm.view_lead","sales.view_booking","sales.view_opportunity","sales.view_performance","integration.view_logs"],
    "branch_manager": ["user.view","dashboard.view_branch","growth.view_summary","crm.view_customer","crm.view_lead","sales.view_booking","sales.view_opportunity","sales.view_performance"],
    "staff": ["crm.view_customer","crm.view_lead","sales.view_booking"],
    "sales_agent": ["dashboard.view_agent","crm.view_lead","sales.view_booking","sales.view_opportunity","sales.view_performance"],
    "affiliate": ["dashboard.view_affiliate","affiliate.view_commission","affiliate.manage_link"],
    "finance_admin": ["dashboard.view_finance","billing.view_invoice","billing.view_payment","billing.manage_subscription","billing.mark_paid","billing.refund","cost.view_summary","cost.view_trend","cost.view_token_usage","audit.view_logs","approval.billing_adjustment"],
    "read_only_analyst": ["dashboard.view_clinic","dashboard.view_branch","dashboard.view_finance","growth.view_summary","growth.view_funnel","growth.view_snapshot","cost.view_summary","cost.view_trend","crm.view_customer","sales.view_booking","sales.view_performance"],
}

ROLE_SCOPE_MAP: Dict[str, List[str]] = {
    "platform_admin": ["platform","partner","tenant","clinic","branch","self"],
    "platform_ops": ["platform","partner","tenant","clinic","branch","self"],
    "partner_admin": ["partner","tenant","clinic","branch","self"],
    "clinic_owner": ["clinic","branch","self"],
    "clinic_admin": ["clinic","branch","self"],
    "branch_manager": ["branch","self"],
    "staff": ["branch","self"],
    "sales_agent": ["self"],
    "affiliate": ["self"],
    "finance_admin": ["tenant","clinic","branch","self"],
    "read_only_analyst": ["tenant","clinic","branch","self"],
}

RESOURCE_SCOPE_RULES: Dict[str, str] = {
    "dashboard.view_platform":"platform","dashboard.view_partner":"partner","dashboard.view_clinic":"clinic","dashboard.view_branch":"branch","dashboard.view_affiliate":"self","dashboard.view_agent":"self","dashboard.view_finance":"tenant",
    "billing.manage_subscription":"clinic","billing.mark_paid":"tenant","billing.refund":"tenant","billing.view_invoice":"tenant","billing.view_payment":"tenant",
    "growth.manage_rules":"clinic","growth.execute_action":"clinic","growth.view_summary":"clinic","growth.view_funnel":"clinic","growth.view_snapshot":"clinic",
    "cost.view_summary":"tenant","cost.view_trend":"tenant","cost.view_token_usage":"tenant","cost.manage_budget_policy":"tenant",
    "integration.manage_channel":"clinic","integration.view_logs":"clinic","integration.rotate_secret":"clinic",
    "crm.view_customer":"clinic","crm.view_lead":"clinic","sales.view_booking":"clinic","sales.view_opportunity":"clinic","sales.view_performance":"self",
    "affiliate.view_commission":"self","affiliate.manage_link":"self",
    "audit.view_logs":"tenant",
    "approval.promotion":"clinic","approval.billing_adjustment":"tenant","approval.integration_rotation":"clinic","approval.role_escalation":"tenant",
}

PERMISSION_OVERRIDES: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _parse_iso(value):
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z",""))
    except: return None
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _safe_list(value): return value if isinstance(value, list) else []
def _safe_dict(value): return value if isinstance(value, dict) else {}

def _is_override_active(item):
    if _normalize_text(item.get("status")) != "active": return False
    expires_at = item.get("expires_at")
    if not expires_at: return True
    dt = _parse_iso(expires_at)
    if not dt: return True
    return datetime.utcnow() <= dt

def get_permissions_for_role(role_name): return ROLE_PERMISSION_MAP.get(_normalize_text(role_name), [])
def get_allowed_scopes_for_role(role_name): return ROLE_SCOPE_MAP.get(_normalize_text(role_name), [])
def get_required_scope_for_action(action): return RESOURCE_SCOPE_RULES.get(_normalize_text(action))
def role_has_permission(role_name, action):
    permissions = get_permissions_for_role(role_name)
    if "*" in permissions: return True
    return _normalize_text(action) in {_normalize_text(x) for x in permissions}

def get_permission_overrides_for_user(user_id):
    return [x for x in PERMISSION_OVERRIDES if x.get("user_id") == user_id and _is_override_active(x)]

def evaluate_permission_override(user_id, action):
    normalized_action = _normalize_text(action)
    matched = [item for item in get_permission_overrides_for_user(user_id) if _normalize_text(item.get("permission")) == normalized_action]
    if not matched: return None
    for item in matched:
        if _normalize_text(item.get("effect")) == "deny": return {"matched":True,"effect":"deny","source":"permission_override","override":item}
    for item in matched:
        if _normalize_text(item.get("effect")) == "allow": return {"matched":True,"effect":"allow","source":"permission_override","override":item}
    return None

def scope_matches_resource(role_scope, auth_context, resource_scope, resource_context=None):
    resource_context = _safe_dict(resource_context)
    role_scope = _normalize_text(role_scope)
    resource_scope = _normalize_text(resource_scope)
    if role_scope == "platform": return {"matched":True,"reason":"platform_scope"}
    if resource_scope == "self":
        target_user_id = resource_context.get("user_id") or resource_context.get("owner_user_id")
        if not target_user_id: return {"matched":False,"reason":"self_scope_missing_target_user_id"}
        matched = auth_context.get("user_id") == target_user_id
        return {"matched":matched,"reason":"self_scope_match" if matched else "self_scope_mismatch"}
    if resource_scope == "partner":
        target_partner_id = resource_context.get("partner_id")
        if role_scope == "partner" and auth_context.get("partner_id") == target_partner_id: return {"matched":True,"reason":"partner_scope_match"}
        return {"matched":False,"reason":"partner_scope_mismatch"}
    if resource_scope == "tenant":
        target_tenant_id = resource_context.get("tenant_id")
        if role_scope in {"tenant","clinic","branch"} and auth_context.get("tenant_id") == target_tenant_id: return {"matched":True,"reason":"tenant_scope_match"}
        if role_scope == "partner" and resource_context.get("partner_id") == auth_context.get("partner_id"): return {"matched":True,"reason":"partner_to_tenant_scope_match"}
        return {"matched":False,"reason":"tenant_scope_mismatch"}
    if resource_scope == "clinic":
        target_clinic_id = resource_context.get("clinic_id")
        target_tenant_id = resource_context.get("tenant_id")
        if role_scope == "clinic" and auth_context.get("clinic_id") == target_clinic_id: return {"matched":True,"reason":"clinic_scope_match"}
        if role_scope == "branch": return {"matched":False,"reason":"branch_scope_cannot_access_clinic_scope"}
        if role_scope == "tenant" and auth_context.get("tenant_id") == target_tenant_id: return {"matched":True,"reason":"tenant_to_clinic_scope_match"}
        if role_scope == "partner" and resource_context.get("partner_id") == auth_context.get("partner_id"): return {"matched":True,"reason":"partner_to_clinic_scope_match"}
        return {"matched":False,"reason":"clinic_scope_mismatch"}
    if resource_scope == "branch":
        target_branch_id = resource_context.get("branch_id")
        target_clinic_id = resource_context.get("clinic_id")
        target_tenant_id = resource_context.get("tenant_id")
        if role_scope == "branch" and auth_context.get("branch_id") == target_branch_id: return {"matched":True,"reason":"branch_scope_match"}
        if role_scope == "clinic" and auth_context.get("clinic_id") == target_clinic_id: return {"matched":True,"reason":"clinic_to_branch_scope_match"}
        if role_scope == "tenant" and auth_context.get("tenant_id") == target_tenant_id: return {"matched":True,"reason":"tenant_to_branch_scope_match"}
        if role_scope == "partner" and resource_context.get("partner_id") == auth_context.get("partner_id"): return {"matched":True,"reason":"partner_to_branch_scope_match"}
        return {"matched":False,"reason":"branch_scope_mismatch"}
    return {"matched":False,"reason":"unsupported_scope"}

def check_permission(auth_context, action, resource_context=None):
    resource_context = _safe_dict(resource_context)
    action = _normalize_text(action)
    user_id = auth_context.get("user_id")
    assigned_roles = _safe_list(auth_context.get("assigned_roles"))
    if not user_id: return {"allow":False,"reason":"missing_user_id","matched_role":None,"matched_scope":None,"evaluated_at":_now_iso()}
    override = evaluate_permission_override(user_id, action)
    if override:
        if override["effect"] == "deny": return {"allow":False,"reason":"permission_denied_by_override","matched_role":None,"matched_scope":None,"override":override["override"],"evaluated_at":_now_iso()}
        if override["effect"] == "allow":
            required_scope = get_required_scope_for_action(action)
            if required_scope and resource_context:
                scope_check = scope_matches_resource(role_scope=required_scope, auth_context=auth_context, resource_scope=required_scope, resource_context=resource_context)
                if not scope_check["matched"]: return {"allow":False,"reason":f"override_allow_but_scope_mismatch:{scope_check['reason']}","matched_role":None,"matched_scope":None,"override":override["override"],"evaluated_at":_now_iso()}
            return {"allow":True,"reason":"permission_allowed_by_override","matched_role":"override","matched_scope":get_required_scope_for_action(action),"override":override["override"],"evaluated_at":_now_iso()}
    required_scope = get_required_scope_for_action(action)
    for role_name in assigned_roles:
        normalized_role = _normalize_text(role_name)
        if not role_has_permission(normalized_role, action): continue
        allowed_scopes = get_allowed_scopes_for_role(normalized_role)
        if required_scope and required_scope not in allowed_scopes and normalized_role != "platform_admin": continue
        if required_scope:
            matched_any_scope = False
            matched_scope_reason = "scope_not_checked"
            for role_scope in allowed_scopes:
                scope_check = scope_matches_resource(role_scope=role_scope, auth_context=auth_context, resource_scope=required_scope, resource_context=resource_context)
                if scope_check["matched"]:
                    matched_any_scope = True
                    matched_scope_reason = scope_check["reason"]
                    break
            if resource_context and not matched_any_scope: continue
            return {"allow":True,"reason":f"permission_allowed:{matched_scope_reason}","matched_role":normalized_role,"matched_scope":required_scope,"evaluated_at":_now_iso()}
        return {"allow":True,"reason":"permission_allowed_no_scope_required","matched_role":normalized_role,"matched_scope":None,"evaluated_at":_now_iso()}
    return {"allow":False,"reason":"permission_denied","matched_role":None,"matched_scope":None,"evaluated_at":_now_iso()}

def list_allowed_actions(auth_context, candidate_actions, resource_context=None):
    allowed = []
    denied = []
    for action in candidate_actions:
        result = check_permission(auth_context, action, resource_context=resource_context)
        if result["allow"]: allowed.append(action)
        else: denied.append({"action":action,"reason":result["reason"]})
    return {"user_id":auth_context.get("user_id"),"allowed_actions":allowed,"denied_actions":denied,"evaluated_at":_now_iso()}

def validate_permission_result(result):
    errors = []
    for field in ["allow","reason","matched_role","matched_scope","evaluated_at"]:
        if field not in result: errors.append(f"missing {field}")
    if not isinstance(result.get("allow"), bool): errors.append("allow must be bool")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== PERMISSION ENGINE TEST ===")
    clinic_owner_ctx = {"user_id":"u_001","assigned_roles":["clinic_owner"],"partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":None}
    case_1 = check_permission(auth_context=clinic_owner_ctx, action="billing.manage_subscription", resource_context={"tenant_id":"t_001","clinic_id":"c_001"})
    print("CASE 1:", case_1)
    print(validate_permission_result(case_1))
