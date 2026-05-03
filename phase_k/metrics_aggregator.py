from __future__ import annotations
import json
import os
from typing import Any, Dict, Optional, Union
from dashboard_repository import DashboardFilters, get_dashboard_repository
from dashboard_query_service import build_owner_dashboard_data

DASHBOARD_MODE = os.getenv("DASHBOARD_MODE", "prod").strip().lower()
WRITE_ARTIFACTS = os.getenv("WRITE_METRICS_ARTIFACT", "false").strip().lower() == "true"
ARTIFACT_PATH = os.getenv("METRICS_ARTIFACT_PATH", "metrics_output.json")

def _load_demo_metrics():
    try:
        with open(ARTIFACT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict): return data
    except Exception: pass
    return {"meta":{"mode":"demo","data_source":"mock","warning":"demo artifact fallback"},"overview":{},"funnel":{},"trend":[],"top_procedures":[],"top_channels":[],"bookings":{"recent":[],"summary":{}},"customers":{},"affiliate":{},"agent":{},"branch_performance":[],"white_label":{},"insights":[],"alerts":[]}

def _normalize_filters(filters):
    if filters is None: return DashboardFilters()
    if isinstance(filters, DashboardFilters): return filters
    if isinstance(filters, dict):
        return DashboardFilters(tenant_id=filters.get("tenant_id"),clinic_id=filters.get("clinic_id"),branch_id=filters.get("branch_id"),affiliate_id=filters.get("affiliate_id"),agent_id=filters.get("agent_id"),date_from=filters.get("date_from"),date_to=filters.get("date_to"))
    raise TypeError("filters must be DashboardFilters, dict, or None")

def _build_metrics_from_firebase(filters):
    repo = get_dashboard_repository()
    payload = build_owner_dashboard_data(filters=filters, repo=repo)
    return {k: payload.get(k, {} if k not in ["trend","top_procedures","top_channels","branch_performance","insights","alerts"] else []) for k in ["meta","overview","funnel","trend","top_procedures","top_channels","bookings","customers","affiliate","agent","branch_performance","white_label","insights","alerts"]}

def build_metrics(filters=None):
    normalized = _normalize_filters(filters)
    metrics = _load_demo_metrics() if DASHBOARD_MODE == "demo" else _build_metrics_from_firebase(normalized)
    if WRITE_ARTIFACTS:
        try:
            with open(ARTIFACT_PATH, "w", encoding="utf-8") as f:
                json.dump(metrics, f, ensure_ascii=False, indent=2, default=str)
        except Exception: pass
    return metrics

def build_overview_metrics(filters=None): return build_metrics(filters).get("overview", {})
def build_funnel_metrics(filters=None): return build_metrics(filters).get("funnel", {})
def build_trend_metrics(filters=None): return build_metrics(filters).get("trend", [])

if __name__ == "__main__":
    print("=== METRICS AGGREGATOR ===")
    print(f"MODE: {DASHBOARD_MODE}")
    filters = DashboardFilters(tenant_id=os.getenv("TEST_TENANT_ID"),date_from=os.getenv("TEST_DATE_FROM"),date_to=os.getenv("TEST_DATE_TO"))
    metrics = build_metrics(filters)
    print("\nMETA:", metrics.get("meta"))
    print("OVERVIEW:", metrics.get("overview"))
    print("FUNNEL:", metrics.get("funnel"))
    print("TOP PROCEDURES:", metrics.get("top_procedures"))
    print("BRANCH PERFORMANCE:", metrics.get("branch_performance"))
