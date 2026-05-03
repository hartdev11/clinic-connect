from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional
from cost_calculator import get_cost_logs

DEFAULT_MONTHLY_BUDGET_USD = 50.0
WARNING_THRESHOLD = 0.70
CRITICAL_THRESHOLD = 0.85
BLOCK_THRESHOLD = 1.00

TENANT_BUDGET_OVERRIDES: Dict[str, Dict[str, Any]] = {}

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def get_tenant_budget(tenant_id: str) -> Dict[str, Any]:
    override = TENANT_BUDGET_OVERRIDES.get(tenant_id)
    if override:
        return override
    return {
        "tenant_id": tenant_id,
        "monthly_budget_usd": DEFAULT_MONTHLY_BUDGET_USD,
        "warning_threshold": WARNING_THRESHOLD,
        "critical_threshold": CRITICAL_THRESHOLD,
        "block_threshold": BLOCK_THRESHOLD,
        "degrade_at_critical": True,
        "block_at_limit": True,
    }

def set_tenant_budget(tenant_id: str, monthly_budget_usd: float, **kwargs):
    TENANT_BUDGET_OVERRIDES[tenant_id] = {
        "tenant_id": tenant_id,
        "monthly_budget_usd": monthly_budget_usd,
        "warning_threshold": kwargs.get("warning_threshold", WARNING_THRESHOLD),
        "critical_threshold": kwargs.get("critical_threshold", CRITICAL_THRESHOLD),
        "block_threshold": kwargs.get("block_threshold", BLOCK_THRESHOLD),
        "degrade_at_critical": kwargs.get("degrade_at_critical", True),
        "block_at_limit": kwargs.get("block_at_limit", True),
    }

def get_current_spend(tenant_id: str, clinic_id: Optional[str] = None) -> float:
    logs = get_cost_logs(tenant_id=tenant_id)
    if clinic_id:
        logs = [x for x in logs if x.get("clinic_id") == clinic_id]
    return round(sum(_safe_float(x.get("total_cost", 0)) for x in logs), 8)

def check_budget_control(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> Dict[str, Any]:
    budget = get_tenant_budget(tenant_id)
    monthly_budget = _safe_float(budget["monthly_budget_usd"])
    current_spend = get_current_spend(tenant_id=tenant_id, clinic_id=clinic_id)
    projected_spend = current_spend + _safe_float(projected_request_cost)
    usage_percent = projected_spend / monthly_budget if monthly_budget > 0 else 0.0

    if usage_percent >= budget["block_threshold"]:
        status = "blocked"
        action = "block"
    elif usage_percent >= budget["critical_threshold"]:
        status = "critical"
        action = "degrade" if budget["degrade_at_critical"] else "warn"
    elif usage_percent >= budget["warning_threshold"]:
        status = "warning"
        action = "warn"
    else:
        status = "ok"
        action = "allow"

    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "monthly_budget_usd": monthly_budget,
        "current_spend_usd": current_spend,
        "projected_spend_usd": round(projected_spend, 8),
        "projected_request_cost": projected_request_cost,
        "usage_percent": round(usage_percent, 4),
        "status": status,
        "action": action,
        "generated_at": _now_iso(),
    }

def get_budget_decision(tenant_id: str, clinic_id: Optional[str] = None, projected_request_cost: float = 0.0) -> Dict[str, Any]:
    result = check_budget_control(tenant_id=tenant_id, clinic_id=clinic_id, projected_request_cost=projected_request_cost)
    action = result["action"]
    should_proceed = action in {"allow", "warn", "degrade"}
    return {
        "tenant_id": tenant_id,
        "should_proceed": should_proceed,
        "action": action,
        "status": result["status"],
        "usage_percent": result["usage_percent"],
        "current_spend_usd": result["current_spend_usd"],
        "monthly_budget_usd": result["monthly_budget_usd"],
        "generated_at": _now_iso(),
    }

def validate_budget_control_result(result: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","monthly_budget_usd","current_spend_usd","projected_spend_usd","usage_percent","status","action","generated_at"]:
        if field not in result:
            errors.append(f"missing field: {field}")
    if result.get("action") not in {"allow","warn","degrade","block"}:
        errors.append("invalid action")
    if result.get("status") not in {"ok","warning","critical","blocked"}:
        errors.append("invalid status")
    return {"valid": len(errors) == 0, "errors": errors}

def validate_budget_decision(decision: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","should_proceed","action","status","usage_percent","generated_at"]:
        if field not in decision:
            errors.append(f"missing field: {field}")
    if not isinstance(decision.get("should_proceed"), bool):
        errors.append("should_proceed must be bool")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    from cost_calculator import log_and_calculate_cost
    print("=== BUDGET CONTROLLER TEST ===")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_001",
        model="gpt-4.1", input_tokens=5000, output_tokens=8000, channel="line", feature="chat_response")
    result = check_budget_control(tenant_id="tenant_demo", clinic_id="clinic_1", projected_request_cost=0.02)
    print(result)
    print(validate_budget_control_result(result))
    decision = get_budget_decision(tenant_id="tenant_demo", clinic_id="clinic_1", projected_request_cost=0.02)
    print(decision)
    print(validate_budget_decision(decision))
