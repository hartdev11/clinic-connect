from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

MODEL_TIERS = {
    "cheap":    ["gpt-4o-mini", "gpt-4.1-mini", "claude-haiku"],
    "mid":      ["gpt-4.1-mini", "gpt-4o-mini"],
    "premium":  ["gpt-4.1", "gpt-4o", "claude-sonnet"],
}

FEATURE_MODEL_POLICY = {
    "faq_assist":       "cheap",
    "intent_classify":  "cheap",
    "chat_response":    "mid",
    "recommendation":   "mid",
    "closing_assist":   "premium",
    "objection_handle": "premium",
    "default":          "mid",
}

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def get_default_model_for_feature(feature: str) -> str:
    tier = FEATURE_MODEL_POLICY.get(feature, FEATURE_MODEL_POLICY["default"])
    return MODEL_TIERS[tier][0]

def get_fallback_model(current_model: str) -> Optional[str]:
    all_cheap = MODEL_TIERS["cheap"]
    all_mid = MODEL_TIERS["mid"]
    if current_model in MODEL_TIERS["premium"]:
        return all_mid[0]
    if current_model in all_mid:
        return all_cheap[0]
    return None

def route_model(
    feature: str,
    budget_status: str = "ok",
    requested_model: Optional[str] = None,
) -> Dict[str, Any]:
    default_model = get_default_model_for_feature(feature)
    if requested_model:
        selected_model = requested_model
        routing_reason = "requested_by_caller"
    else:
        selected_model = default_model
        routing_reason = "feature_policy"

    if budget_status in {"critical", "blocked"}:
        fallback = get_fallback_model(selected_model)
        if fallback and fallback != selected_model:
            return {"selected_model": fallback, "original_model": selected_model,
                    "routing_reason": "budget_downgrade", "budget_status": budget_status,
                    "downgraded": True, "generated_at": _now_iso()}

    return {"selected_model": selected_model, "original_model": selected_model,
            "routing_reason": routing_reason, "budget_status": budget_status,
            "downgraded": False, "generated_at": _now_iso()}

def validate_routing_result(result: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["selected_model", "original_model", "routing_reason", "budget_status", "downgraded", "generated_at"]:
        if field not in result:
            errors.append(f"missing field: {field}")
    if not result.get("selected_model"):
        errors.append("selected_model is empty")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== MODEL ROUTER TEST ===")
    r1 = route_model(feature="faq_assist", budget_status="ok")
    print("FAQ OK:", r1)
    r2 = route_model(feature="closing_assist", budget_status="critical")
    print("CLOSING CRITICAL:", r2)
    r3 = route_model(feature="chat_response", budget_status="blocked")
    print("CHAT BLOCKED:", r3)
    print(validate_routing_result(r1))
