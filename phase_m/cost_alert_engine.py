from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from budget_controller import check_budget_control, get_budget_decision

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _build_alert(tenant_id, level, alert_type, message, payload=None):
    return {"tenant_id": tenant_id, "level": level, "alert_type": alert_type,
            "message": message, "payload": payload or {}, "created_at": _now_iso()}

def build_budget_alerts(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> List[Dict[str, Any]]:
    result = check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)
    alerts = []
    status = result["status"]
    usage_percent = result["usage_percent"]

    if status == "blocked":
        alerts.append(_build_alert(tenant_id, "critical", "budget_blocked",
            f"Budget blocked: usage {round(usage_percent*100,1)}% of monthly limit", payload=result))
    elif status == "critical":
        alerts.append(_build_alert(tenant_id, "high", "budget_critical",
            f"Budget critical: usage {round(usage_percent*100,1)}% — degrading to cheaper model", payload=result))
    elif status == "warning":
        alerts.append(_build_alert(tenant_id, "medium", "budget_warning",
            f"Budget warning: usage {round(usage_percent*100,1)}% of monthly limit", payload=result))

    return alerts

def build_growth_handoff(alerts: List[Dict], budget_result: Dict) -> Dict[str, Any]:
    status = budget_result.get("status", "ok")
    enabled = status in {"warning", "critical", "blocked"}
    payload = {}
    if enabled:
        if status == "blocked":
            payload = {"trigger_type": "force_topup", "reason": "budget_blocked", "usage_percent": budget_result.get("usage_percent")}
        elif status == "critical":
            payload = {"trigger_type": "show_topup_offer", "reason": "budget_critical", "usage_percent": budget_result.get("usage_percent")}
        else:
            payload = {"trigger_type": "prepare_topup", "reason": "budget_warning", "usage_percent": budget_result.get("usage_percent")}
    return {"enabled": enabled, "payload": payload}

def build_monetization_handoff(alerts: List[Dict], budget_result: Dict) -> Dict[str, Any]:
    status = budget_result.get("status", "ok")
    enabled = status in {"critical", "blocked"}
    payload = {}
    if enabled:
        payload = {"action": "suggest_topup", "tenant_id": budget_result.get("tenant_id"),
                   "current_spend_usd": budget_result.get("current_spend_usd"),
                   "monthly_budget_usd": budget_result.get("monthly_budget_usd")}
    return {"enabled": enabled, "payload": payload}

def build_dashboard_handoff(alerts: List[Dict], budget_result: Dict) -> Dict[str, Any]:
    return {
        "enabled": len(alerts) > 0,
        "payload": {
            "alert_count": len(alerts),
            "highest_level": alerts[0]["level"] if alerts else None,
            "status": budget_result.get("status"),
            "usage_percent": budget_result.get("usage_percent"),
            "current_spend_usd": budget_result.get("current_spend_usd"),
        }
    }

def build_cost_alert_package(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> Dict[str, Any]:
    budget_result = check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)
    alerts = build_budget_alerts(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)
    growth_handoff = build_growth_handoff(alerts=alerts, budget_result=budget_result)
    monetization_handoff = build_monetization_handoff(alerts=alerts, budget_result=budget_result)
    dashboard_handoff = build_dashboard_handoff(alerts=alerts, budget_result=budget_result)
    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "budget_status": budget_result["status"],
        "usage_percent": budget_result["usage_percent"],
        "alert_count": len(alerts),
        "alerts": alerts,
        "growth_handoff": growth_handoff,
        "monetization_handoff": monetization_handoff,
        "dashboard_handoff": dashboard_handoff,
        "generated_at": _now_iso(),
    }

def validate_cost_alert_package(package: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","budget_status","usage_percent","alert_count","alerts","growth_handoff","monetization_handoff","dashboard_handoff","generated_at"]:
        if field not in package:
            errors.append(f"missing field: {field}")
    if not isinstance(package.get("alerts", []), list):
        errors.append("alerts must be a list")
    for idx, alert in enumerate(package.get("alerts", [])):
        for field in ["tenant_id","level","alert_type","message","payload","created_at"]:
            if field not in alert:
                errors.append(f"alerts[{idx}] missing {field}")
    for handoff_key in ["growth_handoff","monetization_handoff","dashboard_handoff"]:
        handoff = package.get(handoff_key, {})
        if not isinstance(handoff, dict):
            errors.append(f"{handoff_key} must be a dict")
            continue
        for field in ["enabled","payload"]:
            if field not in handoff:
                errors.append(f"{handoff_key} missing {field}")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    from cost_calculator import log_and_calculate_cost
    print("=== COST ALERT ENGINE TEST ===")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_alert_001",
        model="gpt-4.1", input_tokens=7000, output_tokens=9000, channel="line", feature="chat_response")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_alert_002",
        model="gpt-4.1", input_tokens=8000, output_tokens=10000, channel="line", feature="closing_assist")
    package = build_cost_alert_package(tenant_id="tenant_demo", clinic_id="clinic_1", projected_request_cost=0.05)
    print(package)
    print(validate_cost_alert_package(package))
