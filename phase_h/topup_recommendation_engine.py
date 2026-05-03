from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from wallet_manager import get_wallet
from usage_tracker import get_usage_logs
from pricing_resolver import load_pricing_config
from usage_trigger_engine import build_usage_triggers

DEFAULT_RECOMMENDATION_CONFIG = {
    "lookback_days": 7,
    "urgent_days_left_threshold": 1,
    "high_days_left_threshold": 3,
    "medium_days_left_threshold": 7,
    "minimum_confidence": 0.50,
}

def _now(): return datetime.utcnow()
def _now_iso(): return _now().replace(microsecond=0).isoformat() + "Z"
def _safe_int(v):
    try: return int(v)
    except: return 0
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _parse_iso(value):
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z", ""))
    except: return None

def _get_active_topup_packs():
    config = load_pricing_config()
    packs = config.get("topup_rules", {}).get("packs", [])
    result = []
    for pack in packs:
        if pack.get("is_active", True):
            result.append({"pack_id":pack.get("pack_id"),"name":pack.get("name"),"tokens":_safe_int(pack.get("tokens",0)),"bonus_tokens":_safe_int(pack.get("bonus_tokens",0)),"price":_safe_float(pack.get("price",0))})
    return result

def _total_pack_tokens(pack):
    return _safe_int(pack.get("tokens",0)) + _safe_int(pack.get("bonus_tokens",0))

def _severity_rank(level):
    return {"safe":0,"medium":1,"high":2,"critical":3}.get(level, 0)

def summarize_usage_velocity(tenant_id, lookback_days=7):
    usage_logs = get_usage_logs(tenant_id)
    cutoff = _now() - timedelta(days=lookback_days)
    relevant_logs = []
    total_cost = 0
    for item in usage_logs:
        created_at = _parse_iso(item.get("created_at"))
        if created_at and created_at >= cutoff:
            relevant_logs.append(item)
            total_cost += _safe_int(item.get("cost",0))
    days = max(lookback_days, 1)
    avg_daily_usage = total_cost / days
    return {"tenant_id":tenant_id,"lookback_days":lookback_days,"usage_event_count":len(relevant_logs),"total_cost_in_window":total_cost,"avg_daily_usage":round(avg_daily_usage,4),"generated_at":_now_iso()}

def estimate_days_left(current_balance, avg_daily_usage):
    current_balance = max(0, _safe_int(current_balance))
    avg_daily_usage = max(0.0, _safe_float(avg_daily_usage))
    if avg_daily_usage <= 0: return None
    return round(current_balance / avg_daily_usage, 2)

def select_best_topup_pack(packs, deficit_tokens):
    if deficit_tokens <= 0: return None
    normalized = []
    for pack in packs:
        total_tokens = _total_pack_tokens(pack)
        if total_tokens > 0: normalized.append({**pack,"total_tokens":total_tokens})
    if not normalized: return None
    normalized.sort(key=lambda x: (x["total_tokens"], x["price"]))
    for pack in normalized:
        if pack["total_tokens"] >= deficit_tokens: return pack
    return normalized[-1]

def classify_recommendation_urgency(days_left, trigger_bundle, config):
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    level = highest.get("level", "low")
    if _severity_rank(level) >= _severity_rank("critical"): return "critical"
    if days_left is None: return "medium"
    if days_left <= config["urgent_days_left_threshold"]: return "critical"
    if days_left <= config["high_days_left_threshold"]: return "high"
    if days_left <= config["medium_days_left_threshold"]: return "medium"
    return "low"

def compute_recommendation_confidence(avg_daily_usage, trigger_bundle):
    confidence = 0.5
    if avg_daily_usage > 0: confidence += 0.2
    if trigger_bundle.get("trigger_count", 0) > 0: confidence += 0.2
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    if highest.get("level") in {"high","critical"}: confidence += 0.1
    return round(min(confidence, 0.99), 2)

def build_topup_recommendation(tenant_id, included_tokens, estimated_cost_per_action=1, phase_k_metrics=None, config=None):
    config = {**DEFAULT_RECOMMENDATION_CONFIG, **(config or {})}
    wallet = get_wallet(tenant_id)
    current_balance = _safe_int(wallet.get("balance_tokens", 0))
    velocity = summarize_usage_velocity(tenant_id=tenant_id, lookback_days=config["lookback_days"])
    avg_daily_usage = _safe_float(velocity.get("avg_daily_usage", 0))
    days_left = estimate_days_left(current_balance, avg_daily_usage)
    trigger_bundle = build_usage_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    projected_need = int(round(avg_daily_usage * 30, 0))
    projected_need = max(projected_need, included_tokens)
    deficit_tokens = max(projected_need - current_balance, 0)
    packs = _get_active_topup_packs()
    recommended_pack = select_best_topup_pack(packs=packs, deficit_tokens=deficit_tokens)
    urgency = classify_recommendation_urgency(days_left=days_left, trigger_bundle=trigger_bundle, config=config)
    confidence = compute_recommendation_confidence(avg_daily_usage=avg_daily_usage, trigger_bundle=trigger_bundle)
    should_recommend = (recommended_pack is not None and confidence >= config["minimum_confidence"] and urgency in {"medium","high","critical"})
    reason_parts = []
    if days_left is not None: reason_parts.append(f"estimated balance will last about {days_left} days")
    highest = trigger_bundle.get("highest_priority_trigger")
    if highest: reason_parts.append(f"highest trigger is {highest.get('trigger_type')} ({highest.get('level')})")
    if recommended_pack: reason_parts.append(f"recommended pack {recommended_pack['pack_id']} provides {recommended_pack['total_tokens']} tokens")
    return {"tenant_id":tenant_id,"should_recommend":should_recommend,"urgency":urgency,"confidence":confidence,"current_balance":current_balance,"avg_daily_usage":avg_daily_usage,"estimated_days_left":days_left,"projected_monthly_need":projected_need,"deficit_tokens":deficit_tokens,"recommended_pack":recommended_pack,"reason":"; ".join(reason_parts) if reason_parts else "insufficient data","trigger_bundle":trigger_bundle,"generated_at":_now_iso()}

def validate_topup_recommendation(result):
    errors = []
    for field in ["tenant_id","should_recommend","urgency","confidence","current_balance","avg_daily_usage","projected_monthly_need","deficit_tokens","reason","trigger_bundle","generated_at"]:
        if field not in result: errors.append(f"missing field: {field}")
    if result.get("urgency") not in {"low","medium","high","critical"}: errors.append("invalid urgency")
    confidence = _safe_float(result.get("confidence", 0))
    if confidence < 0 or confidence > 1: errors.append("confidence must be between 0 and 1")
    if result.get("recommended_pack") is not None:
        pack = result["recommended_pack"]
        for field in ["pack_id","name","total_tokens","price"]:
            if field not in pack: errors.append(f"recommended_pack missing field: {field}")
    if not isinstance(result.get("trigger_bundle",{}), dict): errors.append("trigger_bundle must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    print("=== TOPUP RECOMMENDATION ENGINE TEST ===")
    tenant = "tenant_h2_demo"
    create_wallet(tenant)
    add_tokens(tenant, 600, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":150,"ref_id":"req_h2_001"})
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":180,"ref_id":"req_h2_002"})
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":120,"ref_id":"req_h2_003"})
    phase_k_metrics = {"overview":{"total_sessions":80,"total_bookings":8,"total_revenue":25000},"funnel":{"view":150,"click":60,"booking":8},"bookings":{"summary":{"pending":5,"confirmed":2,"completed":1}}}
    recommendation = build_topup_recommendation(tenant_id=tenant, included_tokens=1000, estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics)
    print(recommendation)
    print(validate_topup_recommendation(recommendation))
