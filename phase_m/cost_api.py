from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional
from cost_calculator import log_and_calculate_cost, get_cost_logs
from cost_aggregator import build_cost_aggregation_package
from budget_controller import check_budget_control, get_budget_decision, get_current_spend
from cost_alert_engine import build_cost_alert_package
from fallback_engine import build_fallback_plan, apply_fallback_plan
from model_router import route_model
from response_cache import get_or_set_cached_response, get_cache_stats

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def get_cost_dashboard(tenant_id: str, clinic_id: Optional[str] = None) -> Dict[str, Any]:
    package = build_cost_aggregation_package(tenant_id=tenant_id, clinic_id=clinic_id)
    budget = check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id)
    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "cost_summary": package["summary"],
        "daily_trend": package["daily_trend"],
        "budget_status": budget["status"],
        "usage_percent": budget["usage_percent"],
        "current_spend_usd": budget["current_spend_usd"],
        "monthly_budget_usd": budget["monthly_budget_usd"],
        "generated_at": _now_iso(),
    }

def get_cost_alerts(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> Dict[str, Any]:
    return build_cost_alert_package(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)

def get_budget_status(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> Dict[str, Any]:
    return check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)

def get_routing_decision(feature: str, budget_status: str = "ok", requested_model: Optional[str] = None) -> Dict[str, Any]:
    return route_model(feature=feature, budget_status=budget_status, requested_model=requested_model)

def get_fallback_decision(tenant_id: str, clinic_id: Optional[str] = None, current_model: str = "gpt-4.1",
                          feature: str = "chat_response", projected_request_cost: float = 0.0) -> Dict[str, Any]:
    return build_fallback_plan(tenant_id=tenant_id, clinic_id=clinic_id, current_model=current_model,
                               feature=feature, projected_request_cost=projected_request_cost)

def record_usage(tenant_id: str, clinic_id: str, session_id: str, model: str,
                 input_tokens: int, output_tokens: int, channel: str = "unknown",
                 feature: str = "unknown", metadata: Optional[Dict] = None) -> Dict[str, Any]:
    return log_and_calculate_cost(tenant_id=tenant_id, clinic_id=clinic_id, session_id=session_id,
                                  model=model, input_tokens=input_tokens, output_tokens=output_tokens,
                                  channel=channel, feature=feature, metadata=metadata)

def get_cache_status() -> Dict[str, Any]:
    return get_cache_stats()

def process_request(
    tenant_id: str,
    clinic_id: str,
    session_id: str,
    feature: str,
    user_message: str,
    intent: str,
    projected_cost: float = 0.01,
) -> Dict[str, Any]:
    cache_result = get_or_set_cached_response(
        user_message=user_message, intent=intent,
        feature=feature, clinic_id=clinic_id,
    )
    if cache_result["cache_hit"]:
        return {"status": "cache_hit", "source": "cache",
                "response_text": cache_result["cached_item"]["response_text"],
                "cache_key": cache_result["cache_key"]}

    budget = get_budget_decision(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_cost)
    if not budget["should_proceed"]:
        return {"status": "blocked", "reason": budget["action"],
                "usage_percent": budget["usage_percent"]}

    routing = route_model(feature=feature, budget_status=budget["status"])
    fallback = build_fallback_plan(tenant_id=tenant_id, clinic_id=clinic_id,
                                   current_model=routing["selected_model"],
                                   feature=feature, projected_request_cost=projected_cost)

    return {
        "status": "proceed",
        "selected_model": fallback.get("recommended_model") or routing["selected_model"],
        "model_downgraded": fallback.get("model_downgraded", False),
        "budget_status": budget["status"],
        "max_response_tokens": fallback.get("max_response_tokens"),
        "max_context_items": fallback.get("max_context_items"),
        "cache_hit": False,
        "generated_at": _now_iso(),
    }

def validate_cost_dashboard(dashboard: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","cost_summary","daily_trend","budget_status","usage_percent","current_spend_usd","monthly_budget_usd","generated_at"]:
        if field not in dashboard:
            errors.append(f"missing field: {field}")
    if dashboard.get("budget_status") not in {"ok","warning","critical","blocked"}:
        errors.append("invalid budget_status")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    from cost_calculator import log_and_calculate_cost
    print("=== COST API TEST ===")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_api_001",
        model="gpt-4o-mini", input_tokens=300, output_tokens=600, channel="line", feature="faq_assist")
    dashboard = get_cost_dashboard(tenant_id="tenant_demo", clinic_id="clinic_1")
    print("DASHBOARD:", dashboard)
    print(validate_cost_dashboard(dashboard))
    result = process_request(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_api_002",
        feature="faq_assist", user_message="Botox ช่วยอะไร", intent="faq", projected_cost=0.005)
    print("PROCESS:", result)
