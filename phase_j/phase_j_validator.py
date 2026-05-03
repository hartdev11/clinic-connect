from __future__ import annotations
from typing import Dict, Any
from role_manager import assign_role, seed_default_roles
from permission_engine import check_permission
from tenant_scope_guard import enforce_tenant_scope_guard
from api_access_guard import api_guard
from dashboard_access_mapper import resolve_dashboard_access
from audit_logger import log_action, validate_audit_record
from role_admin_api import api_assign_role

def _print_result(name, result):
    status = "PASS" if result else "FAIL"
    print(f"[{status}] {name}")

def test_role_manager():
    try:
        seed_default_roles()
        result = assign_role(user_id="u_test", role_name="clinic_owner", tenant_id="t_test", clinic_id="c_test")
        return result.get("success") is True
    except: return False

def test_permission_engine():
    try:
        ctx = {"user_id":"u_test","assigned_roles":["clinic_owner"],"tenant_id":"t_test","clinic_id":"c_test"}
        result = check_permission(auth_context=ctx, action="billing.manage_subscription", resource_context={"tenant_id":"t_test","clinic_id":"c_test"})
        return result.get("allow") is True
    except: return False

def test_scope_guard():
    try:
        ctx = {"user_id":"u_test","tenant_id":"t_test","clinic_id":"c_test"}
        result = enforce_tenant_scope_guard(auth_context=ctx, user_scope="clinic", resource_scope="clinic", resource_context={"tenant_id":"t_test","clinic_id":"c_test"})
        return result.get("allow") is True
    except: return False

def test_api_guard():
    try:
        result = api_guard(token="token_abc", action="dashboard.view_branch", resource_scope="branch", resource_context={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001"})
        return result.get("allow") is True
    except: return False

def test_dashboard_mapper():
    try:
        ctx = {"user_id":"u_test","assigned_roles":["clinic_owner"]}
        profile = resolve_dashboard_access(ctx)
        return "dashboards" in profile
    except: return False

def test_audit_logger():
    try:
        log = log_action(user_id="u_test", action="login")
        validation = validate_audit_record(log)
        return validation.get("valid") is True
    except: return False

def test_admin_api():
    try:
        result = api_assign_role(token="token_abc", payload={"user_id":"u_999","role_name":"branch_manager","tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001"})
        return result.get("success") is True
    except: return False

def run_phase_j_validator():
    print("\n=== PHASE J VALIDATOR ===\n")
    results = {
        "role_manager": test_role_manager(),
        "permission_engine": test_permission_engine(),
        "tenant_scope_guard": test_scope_guard(),
        "api_guard": test_api_guard(),
        "dashboard_mapper": test_dashboard_mapper(),
        "audit_logger": test_audit_logger(),
        "admin_api": test_admin_api(),
    }
    for name, res in results.items(): _print_result(name, res)
    all_pass = all(results.values())
    print("\n========================")
    print("FINAL RESULT:", "PASS" if all_pass else "FAIL")
    return {"success":all_pass,"details":results}

if __name__ == "__main__":
    run_phase_j_validator()
