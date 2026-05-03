from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List

DASHBOARD_ROLE_MAP: Dict[str, List[str]] = {
    "platform_admin": ["platform_dashboard","partner_dashboard","owner_dashboard","clinic_dashboard","branch_dashboard","affiliate_dashboard","agent_dashboard","finance_dashboard"],
    "platform_ops": ["partner_dashboard","owner_dashboard","clinic_dashboard","branch_dashboard","affiliate_dashboard","agent_dashboard"],
    "partner_admin": ["partner_dashboard","owner_dashboard","clinic_dashboard","branch_dashboard"],
    "clinic_owner": ["owner_dashboard","clinic_dashboard","branch_dashboard","affiliate_dashboard","agent_dashboard","finance_dashboard"],
    "clinic_admin": ["clinic_dashboard","branch_dashboard"],
    "branch_manager": ["branch_dashboard"],
    "staff": ["branch_dashboard"],
    "sales_agent": ["agent_dashboard"],
    "affiliate": ["affiliate_dashboard"],
    "finance_admin": ["finance_dashboard","owner_dashboard"],
    "read_only_analyst": ["clinic_dashboard","branch_dashboard","finance_dashboard"],
}

DASHBOARD_SECTION_MAP: Dict[str, List[str]] = {
    "owner_dashboard": ["summary","revenue","growth","cost","billing","top_branches","top_procedures"],
    "clinic_dashboard": ["summary","bookings","conversion","growth","staff_performance"],
    "branch_dashboard": ["summary","bookings","daily_performance","staff"],
    "affiliate_dashboard": ["clicks","conversion","commissions","links"],
    "agent_dashboard": ["leads","bookings","conversion","performance"],
    "finance_dashboard": ["revenue","invoice","payment","cost","profit"],
    "partner_dashboard": ["tenant_list","revenue","growth"],
    "platform_dashboard": ["system_summary","all_tenants","global_cost"],
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()

def get_allowed_dashboards(roles):
    dashboards = set()
    for role in roles:
        role = _normalize_text(role)
        for d in DASHBOARD_ROLE_MAP.get(role, []): dashboards.add(d)
    return list(dashboards)

def get_dashboard_sections(dashboard):
    return DASHBOARD_SECTION_MAP.get(_normalize_text(dashboard), [])

def build_dashboard_access_profile(auth_context):
    roles = auth_context.get("assigned_roles", [])
    user_id = auth_context.get("user_id")
    dashboards = get_allowed_dashboards(roles)
    profile = {}
    for d in dashboards:
        profile[d] = {"sections":get_dashboard_sections(d),"visible":True}
    return {"user_id":user_id,"dashboards":profile,"evaluated_at":_now_iso()}

def filter_dashboard_by_scope(auth_context, dashboard_profile):
    roles = auth_context.get("assigned_roles", [])
    if "affiliate" in roles:
        dashboard_profile["dashboards"] = {"affiliate_dashboard":dashboard_profile["dashboards"].get("affiliate_dashboard",{})}
    if "sales_agent" in roles:
        dashboard_profile["dashboards"] = {"agent_dashboard":dashboard_profile["dashboards"].get("agent_dashboard",{})}
    if "branch_manager" in roles:
        dashboard_profile["dashboards"] = {"branch_dashboard":dashboard_profile["dashboards"].get("branch_dashboard",{})}
    return dashboard_profile

def resolve_dashboard_access(auth_context):
    base_profile = build_dashboard_access_profile(auth_context)
    return filter_dashboard_by_scope(auth_context, base_profile)

def validate_dashboard_profile(profile):
    errors = []
    if "user_id" not in profile: errors.append("missing user_id")
    if "dashboards" not in profile: errors.append("missing dashboards")
    if not isinstance(profile.get("dashboards"), dict): errors.append("dashboards must be dict")
    return {"valid":len(errors)==0,"errors":errors}

if __name__ == "__main__":
    print("=== DASHBOARD ACCESS TEST ===")
    clinic_owner_ctx = {"user_id":"u_001","assigned_roles":["clinic_owner"]}
    affiliate_ctx = {"user_id":"u_aff_001","assigned_roles":["affiliate"]}
    agent_ctx = {"user_id":"u_agent_001","assigned_roles":["sales_agent"]}
    case_1 = resolve_dashboard_access(clinic_owner_ctx)
    print("OWNER:", case_1)
    print(validate_dashboard_profile(case_1))
    case_2 = resolve_dashboard_access(affiliate_ctx)
    print("AFFILIATE:", case_2)
    case_3 = resolve_dashboard_access(agent_ctx)
    print("AGENT:", case_3)
