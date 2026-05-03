from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from budget_controller import check_budget_control
from model_router import get_fallback_model

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_int(v):
    try: return int(v)
    except: return 0

FEATURE_EXPENSIVE = {"closing_assist", "objection_handle"}

FALLBACK_RULES = {
    "warning":  {"max_response_tokens": 500,  "max_context_items": 6,  "disable_expensive_features": False},
    "critical": {"max_response_tokens": 300,  "max_context_items": 4,  "disable_expensive_features": True},
    "blocked":  {"max_response_tokens": 0,    "max_context_items": 0,  "disable_expensive_features": True},
}

def build_fallback_plan(
    tenant_id: str,
    clinic_id: Optional[str] = None,
    current_model: str = "gpt-4.1",
    feature: str = "chat_response",
    projected_request_cost: float = 0.0,
) -> Dict[str, Any]:
    budget = check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)
    status = budget["status"]
    action = budget["action"]

    if status == "ok":
        return {"tenant_id": tenant_id, "status": status, "action": action,
                "recommended_model": current_model, "original_model": current_model,
                "model_downgraded": False, "max_response_tokens": None,
                "max_context_items": None, "disable_expensive_features": False,
                "should_block": False, "reason": "budget_ok", "generated_at": _now_iso()}

    if status == "blocked":
        return {"tenant_id": tenant_id, "status": status, "action": "block",
                "recommended_model": None, "original_model": current_model,
                "model_downgraded": False, "max_response_tokens": 0,
                "max_context_items": 0, "disable_expensive_features": True,
                "should_block": True, "reason": "budget_blocked", "generated_at": _now_iso()}

    rules = FALLBACK_RULES.get(status, FALLBACK_RULES["warning"])
    fallback_model = get_fallback_model(current_model)
    recommended_model = fallback_model if fallback_model else current_model
    model_downgraded = recommended_model != current_model

    disable_feature = rules["disable_expensive_features"] and feature in FEATURE_EXPENSIVE

    return {
        "tenant_id": tenant_id,
        "status": status,
        "action": action,
        "recommended_model": recommended_model,
        "original_model": current_model,
        "model_downgraded": model_downgraded,
        "max_response_tokens": rules["max_response_tokens"],
        "max_context_items": rules["max_context_items"],
        "disable_expensive_features": rules["disable_expensive_features"],
        "feature_disabled": disable_feature,
        "should_block": False,
        "reason": f"budget_{status}",
        "generated_at": _now_iso(),
    }

def apply_fallback_plan(request_payload: Dict[str, Any], fallback_plan: Dict[str, Any]) -> Dict[str, Any]:
    applied = dict(request_payload)

    if fallback_plan.get("should_block"):
        applied["blocked"] = True
        applied["block_reason"] = fallback_plan.get("reason", "budget_blocked")
        return applied

    if fallback_plan.get("recommended_model"):
        applied["model"] = fallback_plan["recommended_model"]

    max_tokens = fallback_plan.get("max_response_tokens")
    if max_tokens is not None:
        orig = _safe_int(request_payload.get("max_response_tokens", 700))
        applied["max_response_tokens"] = min(orig, max_tokens) if max_tokens > 0 else orig

    max_context = fallback_plan.get("max_context_items")
    if max_context is not None:
        orig = _safe_int(request_payload.get("max_context_items", 8))
        applied["max_context_items"] = min(orig, max_context) if max_context > 0 else orig

    applied["fallback_applied"] = fallback_plan.get("model_downgraded", False)
    applied["fallback_reason"] = fallback_plan.get("reason", "none")
    return applied

def validate_fallback_plan(plan: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","status","action","recommended_model","original_model","model_downgraded","should_block","reason","generated_at"]:
        if field not in plan:
            errors.append(f"missing field: {field}")
    if plan.get("action") not in {"allow","warn","degrade","block"}:
        errors.append("invalid action")
    if not isinstance(plan.get("model_downgraded"), bool):
        errors.append("model_downgraded must be bool")
    return {"valid": len(errors) == 0, "errors": errors}

def validate_applied_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    if "model" not in payload:
        errors.append("missing model")
    if payload.get("blocked") and not payload.get("block_reason"):
        errors.append("blocked payload missing block_reason")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    from cost_calculator import log_and_calculate_cost
    print("=== FALLBACK ENGINE TEST ===")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_fb_001",
        model="gpt-4.1", input_tokens=9000, output_tokens=12000, channel="line", feature="closing_assist")
    plan = build_fallback_plan(tenant_id="tenant_demo", clinic_id="clinic_1",
        current_model="gpt-4.1", feature="closing_assist", projected_request_cost=0.08)
    print(plan)
    print(validate_fallback_plan(plan))
    request_payload = {"model":"gpt-4.1","max_response_tokens":700,"max_context_items":8,"feature":"closing_assist"}
    applied = apply_fallback_plan(request_payload, plan)
    print(applied)
    print(validate_applied_payload(applied))
