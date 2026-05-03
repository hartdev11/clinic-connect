from __future__ import annotations
import os, sys
from typing import Any, Dict, List, Tuple
import requests

BASE_URL = os.getenv("DASHBOARD_BASE_URL", "http://localhost:8000").rstrip("/")
DASHBOARD_MODE = os.getenv("DASHBOARD_MODE", "prod").strip().lower()
REQUEST_TIMEOUT = int(os.getenv("DASHBOARD_CHECK_TIMEOUT", "20"))
TEST_TENANT_ID = os.getenv("TEST_TENANT_ID", "")
TEST_BRANCH_ID = os.getenv("TEST_BRANCH_ID", "")
TEST_DATE_FROM = os.getenv("TEST_DATE_FROM", "")
TEST_DATE_TO = os.getenv("TEST_DATE_TO", "")

REQUIRED_TOP_LEVEL_KEYS = ["meta","overview","funnel","trend","top_procedures","top_channels","bookings","customers","affiliate","agent","branch_performance","white_label","insights","alerts"]
REQUIRED_META_KEYS = ["mode","data_source","role","generated_at","filters","partial_data","data_quality_flags"]
REQUIRED_OVERVIEW_KEYS = ["total_users","total_sessions","total_leads","total_bookings","total_revenue","conversion_rate","ctr"]

def _ok(msg): print(f"[PASS] {msg}")
def _fail(msg): print(f"[FAIL] {msg}")
def _header(title): print(f"\n=== {title} ===")

def _request(path, params=None):
    url = f"{BASE_URL}{path}"
    try:
        res = requests.get(url, params=params or {}, timeout=REQUEST_TIMEOUT)
        try: data = res.json()
        except: data = res.text
        return True, res.status_code, data
    except Exception as e:
        return False, 0, str(e)

def _validate_health(data):
    errors = []
    if not isinstance(data, dict): return ["health response is not a dict"]
    if data.get("mode") != "prod": errors.append("health.mode must be 'prod'")
    if data.get("data_source") != "firebase": errors.append("health.data_source must be 'firebase'")
    db = data.get("database")
    if not isinstance(db, dict): errors.append("health.database must be a dict")
    elif db.get("status") != "ok": errors.append("database health status must be 'ok'")
    return errors

def _validate_schema(data, expected_role):
    errors = []
    if not isinstance(data, dict): return ["dashboard response is not a dict"]
    for key in REQUIRED_TOP_LEVEL_KEYS:
        if key not in data: errors.append(f"missing top-level key: {key}")
    meta = data.get("meta")
    if not isinstance(meta, dict):
        errors.append("meta must be a dict")
    else:
        for key in REQUIRED_META_KEYS:
            if key not in meta: errors.append(f"missing meta key: {key}")
        if meta.get("mode") != "prod": errors.append("meta.mode must be 'prod'")
        if meta.get("data_source") != "firebase": errors.append("meta.data_source must be 'firebase'")
        if meta.get("role") != expected_role: errors.append(f"meta.role must be '{expected_role}'")
        if not isinstance(meta.get("filters"), dict): errors.append("meta.filters must be a dict")
        if not isinstance(meta.get("data_quality_flags"), list): errors.append("meta.data_quality_flags must be a list")
    overview = data.get("overview")
    if not isinstance(overview, dict):
        errors.append("overview must be a dict")
    else:
        for key in REQUIRED_OVERVIEW_KEYS:
            if key not in overview: errors.append(f"missing overview key: {key}")
        conv = overview.get("conversion_rate")
        if isinstance(conv, (int, float)) and conv > 1.0: errors.append("overview.conversion_rate must not exceed 1.0")
        for key in ["total_users","total_sessions","total_leads","total_bookings","total_revenue"]:
            val = overview.get(key)
            if not isinstance(val, (int, float)) or val < 0: errors.append(f"overview.{key} must be non-negative number")
    if not isinstance(data.get("funnel"), dict): errors.append("funnel must be a dict")
    if not isinstance(data.get("trend"), list): errors.append("trend must be a list")
    if not isinstance(data.get("top_procedures"), list): errors.append("top_procedures must be a list")
    if not isinstance(data.get("top_channels"), list): errors.append("top_channels must be a list")
    bookings = data.get("bookings")
    if not isinstance(bookings, dict): errors.append("bookings must be a dict")
    else:
        if "recent" not in bookings: errors.append("bookings.recent missing")
        if "summary" not in bookings: errors.append("bookings.summary missing")
    if not isinstance(data.get("customers"), dict): errors.append("customers must be a dict")
    if not isinstance(data.get("affiliate"), dict): errors.append("affiliate must be a dict")
    if not isinstance(data.get("agent"), dict): errors.append("agent must be a dict")
    if not isinstance(data.get("branch_performance"), list): errors.append("branch_performance must be a list")
    if not isinstance(data.get("white_label"), dict): errors.append("white_label must be a dict")
    if not isinstance(data.get("insights"), list): errors.append("insights must be a list")
    if not isinstance(data.get("alerts"), list): errors.append("alerts must be a list")
    return errors

def _validate_anti_mock(data):
    errors = []
    text_blob = str(data).lower()
    suspicious = ["dashboard_mock_data","events.jsonl","metrics_output.json","analytics_output.json","insight_output.json","data_source': 'mock'","\"data_source\": \"mock\"","data_source': 'database'","\"data_source\": \"database\""]
    for term in suspicious:
        if term in text_blob: errors.append(f"suspicious mock/sql indicator found: {term}")
    return errors

def _run_check(role, path, params):
    ok, status_code, data = _request(path, params=params)
    if not ok: _fail(f"{role} dashboard request failed: {data}"); return False
    if status_code != 200: _fail(f"{role} dashboard returned HTTP {status_code}: {data}"); return False
    all_errors = []
    all_errors.extend(_validate_schema(data, expected_role=role))
    all_errors.extend(_validate_anti_mock(data))
    if all_errors:
        _fail(f"{role} dashboard validation failed")
        for err in all_errors: print(f"  - {err}")
        return False
    _ok(f"{role} dashboard")
    return True

def main():
    _header("PHASE K PROD CHECK")
    if DASHBOARD_MODE != "prod":
        _fail("DASHBOARD_MODE must be 'prod'"); return 1
    _ok(f"DASHBOARD_MODE={DASHBOARD_MODE}")
    _ok(f"BASE_URL={BASE_URL}")

    _header("HEALTH CHECK")
    ok, status_code, data = _request("/health")
    if not ok: _fail(f"/health request failed: {data}"); return 1
    if status_code != 200: _fail(f"/health returned HTTP {status_code}"); return 1
    health_errors = _validate_health(data)
    if health_errors:
        _fail("/health validation failed")
        for err in health_errors: print(f"  - {err}")
        return 1
    _ok("/health")

    _header("DASHBOARD CHECKS")
    base_params = {"tenant_id": TEST_TENANT_ID, "date_from": TEST_DATE_FROM, "date_to": TEST_DATE_TO}
    checks = [
        ("owner", "/dashboard/owner", base_params),
        ("clinic", "/dashboard/clinic", base_params),
        ("branch", "/dashboard/branch", {**base_params, "branch_id": TEST_BRANCH_ID}),
        ("affiliate", "/dashboard/affiliate", base_params),
        ("agent", "/dashboard/agent", base_params),
    ]

    all_passed = True
    for role, path, params in checks:
        if not _run_check(role, path, params):
            all_passed = False

    print("\n========================")
    if not all_passed:
        print("FINAL RESULT: FAIL"); return 1
    print("FINAL RESULT: PASS — PHASE K FIREBASE PRODUCTION COMPLETE")
    return 0

if __name__ == "__main__":
    sys.exit(main())
