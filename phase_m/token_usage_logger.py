from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

TOKEN_USAGE_LOGS: List[Dict[str, Any]] = []

def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _generate_log_id() -> str:
    return f"tok_{uuid4().hex[:16]}"

def log_token_usage(
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
    total_tokens = input_tokens + output_tokens
    log = {
        "log_id": _generate_log_id(),
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "session_id": session_id,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "channel": channel,
        "feature": feature,
        "metadata": metadata or {},
        "created_at": _now_iso(),
    }
    TOKEN_USAGE_LOGS.append(log)
    return log

def get_token_logs(tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if tenant_id is None:
        return TOKEN_USAGE_LOGS
    return [x for x in TOKEN_USAGE_LOGS if x.get("tenant_id") == tenant_id]

def validate_token_log(log: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    required = ["log_id","tenant_id","clinic_id","session_id","model","input_tokens","output_tokens","total_tokens","channel","feature","created_at"]
    for field in required:
        if field not in log:
            errors.append(f"missing {field}")
    if int(log.get("input_tokens", 0)) < 0:
        errors.append("input_tokens cannot be negative")
    if int(log.get("output_tokens", 0)) < 0:
        errors.append("output_tokens cannot be negative")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== TOKEN USAGE LOGGER TEST ===")
    log = log_token_usage(
        tenant_id="tenant_demo",
        clinic_id="clinic_1",
        session_id="sess_001",
        model="gpt-4o-mini",
        input_tokens=200,
        output_tokens=400,
        channel="line",
        feature="faq_assist",
    )
    print(log)
    print(validate_token_log(log))
