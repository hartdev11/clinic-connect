from __future__ import annotations
from typing import Dict, Any
from role_manager import seed_default_roles, assign_role, revoke_role
from role_admin_api import api_assign_role, api_revoke_role
from api_access_guard import api_guard
from dashboard_access_mapper import resolve_dashboard_access
from audit_logger import list_audit_logs, log_action

def _print_result(name, result):
    status = "PASS" if result else "FAIL"
    print(f"[{status}] {name}")

def test_role_flow():
    try:
        seed_default_roles()
        result = assign_role(user_id="u_test_2", role_name="branch_manager", assigned_by="u_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001")
        if not result.get("success"): return False
        user_role_id = result["assignment"]["user_role_id"]
        revoke = revoke_role(user_role_id=user_role_id, revoked_by="u_001")
        return revoke.get("success") is True
    except: return False

def test_permission_and_scope():
    try:
        allow = api_guard(token="token_abc", action="dashboard.view_branch", resource_scope="branch", resource_context={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001"})
        deny = api_guard(token="token_abc", action="dashboard.view_branch", resource_scope="branch", resource_context={"tenant_id":"t_999","clinic_id":"c_999","branch_id":"b_999"})
        return allow.get("allow") is True and deny.get("allow") is False
    except: return False

def test_dashboard_access():
    try:
        ctx = {"user_id":"u_test","assigned_roles":["affiliate"]}
        profile = resolve_dashboard_access(ctx)
        dashboards = profile.get("dashboards", {})
        return list(dashboards.keys()) == ["affiliate_dashboard"]
    except: return False

def test_billing_access_restriction():
    try:
        result = api_guard(token="token_abc", action="billing.mark_paid", resource_scope="tenant", resource_context={"tenant_id":"t_001"})
        return result.get("allow") is False
    except: return False

def test_audit_logs_created():
    try:
        log_action(user_id="u_001", action="login", tenant_id="t_001", metadata={"method":"final_check"})
        logs = list_audit_logs(tenant_id="t_001")
        return len(logs) > 0
    except: return False

def run_phase_j_final_check():
    print("\n=== PHASE J FINAL CHECK ===\n")
    seed_default_roles()
    results = {
        "role_flow": test_role_flow(),
        "permission_scope": test_permission_and_scope(),
        "dashboard_access": test_dashboard_access(),
        "billing_restriction": test_billing_access_restriction(),
        "audit_logs": test_audit_logs_created(),
    }
    for name, res in results.items(): _print_result(name, res)
    all_pass = all(results.values())
    print("\n========================")
    print("FINAL RESULT:", "PASS — PHASE J COMPLETE" if all_pass else "FAIL")
    return {"success":all_pass,"details":results}

if __name__ == "__main__":
    run_phase_j_final_check()
