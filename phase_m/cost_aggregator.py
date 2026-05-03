from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from cost_calculator import get_cost_logs

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _parse_date(ts):
    try: return datetime.fromisoformat(str(ts).replace("Z","")).strftime("%Y-%m-%d")
    except: return "unknown"

def build_cost_summary(tenant_id: str, clinic_id: Optional[str] = None) -> Dict[str, Any]:
    logs = get_cost_logs(tenant_id=tenant_id)
    if clinic_id:
        logs = [x for x in logs if x.get("clinic_id") == clinic_id]

    total_cost = 0.0
    total_tokens = 0
    by_model: Dict[str, float] = {}
    by_feature: Dict[str, float] = {}
    by_channel: Dict[str, float] = {}
    by_clinic: Dict[str, float] = {}
    by_branch: Dict[str, float] = {}

    for log in logs:
        cost = _safe_float(log.get("total_cost", 0))
        tokens = int(log.get("total_tokens", 0))
        total_cost += cost
        total_tokens += tokens
        model = log.get("model", "unknown")
        feature = log.get("feature", "unknown")
        channel = log.get("channel", "unknown")
        clinic = log.get("clinic_id", "unknown")
        branch = log.get("branch_id") or log.get("metadata", {}).get("branch_id", "unknown")
        by_model[model] = round(by_model.get(model, 0) + cost, 8)
        by_feature[feature] = round(by_feature.get(feature, 0) + cost, 8)
        by_channel[channel] = round(by_channel.get(channel, 0) + cost, 8)
        by_clinic[clinic] = round(by_clinic.get(clinic, 0) + cost, 8)
        by_branch[branch] = round(by_branch.get(branch, 0) + cost, 8)

    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "total_cost_usd": round(total_cost, 8),
        "total_tokens": total_tokens,
        "total_requests": len(logs),
        "by_model": by_model,
        "by_feature": by_feature,
        "by_channel": by_channel,
        "by_clinic": by_clinic,
        "by_branch": by_branch,
        "generated_at": _now_iso(),
    }

def build_daily_trend(tenant_id: str, clinic_id: Optional[str] = None) -> List[Dict[str, Any]]:
    logs = get_cost_logs(tenant_id=tenant_id)
    if clinic_id:
        logs = [x for x in logs if x.get("clinic_id") == clinic_id]

    daily: Dict[str, Dict] = {}
    for log in logs:
        day = _parse_date(log.get("created_at"))
        if day not in daily:
            daily[day] = {"date": day, "total_cost_usd": 0.0, "total_tokens": 0, "request_count": 0}
        daily[day]["total_cost_usd"] = round(daily[day]["total_cost_usd"] + _safe_float(log.get("total_cost", 0)), 8)
        daily[day]["total_tokens"] += int(log.get("total_tokens", 0))
        daily[day]["request_count"] += 1

    return sorted(daily.values(), key=lambda x: x["date"])

def build_cost_aggregation_package(tenant_id: str, clinic_id: Optional[str] = None) -> Dict[str, Any]:
    summary = build_cost_summary(tenant_id=tenant_id, clinic_id=clinic_id)
    trend = build_daily_trend(tenant_id=tenant_id, clinic_id=clinic_id)
    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "summary": summary,
        "daily_trend": trend,
        "generated_at": _now_iso(),
    }

def validate_cost_summary(summary: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","total_cost_usd","total_tokens","total_requests","by_model","by_feature","by_channel","generated_at"]:
        if field not in summary:
            errors.append(f"missing field: {field}")
    if _safe_float(summary.get("total_cost_usd", 0)) < 0:
        errors.append("total_cost_usd cannot be negative")
    return {"valid": len(errors) == 0, "errors": errors}

def validate_cost_aggregation_package(package: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["tenant_id","summary","daily_trend","generated_at"]:
        if field not in package:
            errors.append(f"missing field: {field}")
    if not isinstance(package.get("daily_trend", []), list):
        errors.append("daily_trend must be a list")
    if not isinstance(package.get("summary", {}), dict):
        errors.append("summary must be a dict")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    from cost_calculator import log_and_calculate_cost
    print("=== COST AGGREGATOR TEST ===")
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_a",
        model="gpt-4o-mini", input_tokens=120, output_tokens=300, channel="line", feature="faq_assist",
        metadata={"branch_id": "branch_1"})
    log_and_calculate_cost(tenant_id="tenant_demo", clinic_id="clinic_1", session_id="sess_b",
        model="gpt-4.1-mini", input_tokens=200, output_tokens=500, channel="website", feature="chat_response",
        metadata={"branch_id": "branch_2"})
    from cost_calculator import COST_LOGS
    for item in COST_LOGS:
        if "branch_id" not in item:
            item["branch_id"] = item.get("metadata", {}).get("branch_id")
    summary = build_cost_summary(tenant_id="tenant_demo")
    print(summary)
    print(validate_cost_summary(summary))
    package = build_cost_aggregation_package(tenant_id="tenant_demo")
    print(validate_cost_aggregation_package(package))
