from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4
from token_usage_logger import log_token_usage

COST_LOGS: List[Dict[str, Any]] = []

MODEL_PRICING = {
    "gpt-4.1":        {"input": 0.000002,  "output": 0.000008},
    "gpt-4.1-mini":   {"input": 0.0000004, "output": 0.0000016},
    "gpt-4o":         {"input": 0.0000025, "output": 0.00001},
    "gpt-4o-mini":    {"input": 0.00000015,"output": 0.0000006},
    "claude-sonnet":  {"input": 0.000003,  "output": 0.000015},
    "claude-haiku":   {"input": 0.00000025,"output": 0.00000125},
    "default":        {"input": 0.000002,  "output": 0.000008},
}

def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v: Any) -> float:
    try: return float(v)
    except: return 0.0

def get_model_pricing(model: str) -> Dict[str, float]:
    return MODEL_PRICING.get(model, MODEL_PRICING["default"])

def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> Dict[str, Any]:
    pricing = get_model_pricing(model)
    input_cost = input_tokens * pricing["input"]
    output_cost = output_tokens * pricing["output"]
    total_cost = input_cost + output_cost
    return {
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": round(input_cost, 8),
        "output_cost": round(output_cost, 8),
        "total_cost": round(total_cost, 8),
        "currency": "USD",
    }

def log_and_calculate_cost(
    tenant_id: str,
    clinic_id: str,
    session_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    channel: str = "unknown",
    feature: str = "unknown",
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    log_token_usage(
        tenant_id=tenant_id, clinic_id=clinic_id, session_id=session_id,
        model=model, input_tokens=input_tokens, output_tokens=output_tokens,
        channel=channel, feature=feature, metadata=metadata,
    )
    cost = calculate_cost(model, input_tokens, output_tokens)
    record = {
        "log_id": f"cost_{uuid4().hex[:16]}",
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "session_id": session_id,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "input_cost": cost["input_cost"],
        "output_cost": cost["output_cost"],
        "total_cost": cost["total_cost"],
        "currency": "USD",
        "channel": channel,
        "feature": feature,
        "metadata": metadata or {},
        "created_at": _now_iso(),
    }
    COST_LOGS.append(record)
    return record

def get_cost_logs(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if tenant_id is None: return COST_LOGS
    return [x for x in COST_LOGS if x.get("tenant_id") == tenant_id]

def validate_cost_log(log: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    required = ["log_id","tenant_id","clinic_id","session_id","model","input_tokens","output_tokens","total_cost","currency","created_at"]
    for field in required:
        if field not in log: errors.append(f"missing {field}")
    if _safe_float(log.get("total_cost", 0)) < 0: errors.append("total_cost cannot be negative")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== COST CALCULATOR TEST ===")
    record = log_and_calculate_cost(
        tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_001",
        model="gpt-4o-mini", input_tokens=200, output_tokens=400,
        channel="line", feature="faq_assist",
    )
    print(record)
    print(validate_cost_log(record))
