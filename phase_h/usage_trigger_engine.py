from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from wallet_manager import get_wallet
from usage_tracker import get_usage_logs
from usage_alert_engine import build_usage_alert

DEFAULT_TRIGGER_CONFIG = {
    "usage_warning_70_enabled": True,
    "usage_warning_85_enabled": True,
    "usage_critical_100_enabled": True,
    "wallet_low_balance_enabled": True,
    "inactivity_enabled": True,
    "high_booking_intent_enabled": True,
    "inactivity_days": 7,
    "high_booking_threshold": 3,
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
def _days_since(value):
    dt = _parse_iso(value)
    if not dt: return None
    return max((_now() - dt).days, 0)
def _priority_of(level):
    return {"low":1,"medium":2,"high":3,"critical":4}.get(level, 0)
def _build_trigger(trigger_type, level, suggest_action, reason, should_block=False, metadata=None):
    return {"trigger_type":trigger_type,"level":level,"suggest_action":suggest_action,"reason":reason,"should_block":should_block,"priority":_priority_of(level),"metadata":metadata or {},"created_at":_now_iso()}

def summarize_usage_signals(tenant_id):
    usage_logs = get_usage_logs(tenant_id)
    wallet = get_wallet(tenant_id)
    total_cost = 0
    latest_usage_at = None
    booking_event_count = 0
    conversation_event_count = 0
    llm_token_cost = 0
    for item in usage_logs:
        cost = _safe_int(item.get("cost", 0))
        total_cost += cost
        usage_type = item.get("usage_type")
        if usage_type == "booking_event": booking_event_count += 1
        elif usage_type == "conversation": conversation_event_count += 1
        elif usage_type == "llm_tokens": llm_token_cost += cost
        created_at = item.get("created_at")
        if latest_usage_at is None: latest_usage_at = created_at
        else:
            old_dt = _parse_iso(latest_usage_at)
            new_dt = _parse_iso(created_at)
            if new_dt and old_dt and new_dt > old_dt: latest_usage_at = created_at
    return {"tenant_id":tenant_id,"wallet_balance_tokens":_safe_int(wallet.get("balance_tokens",0)),"wallet_status":wallet.get("status","active"),"total_usage_events":len(usage_logs),"total_cost":total_cost,"booking_event_count":booking_event_count,"conversation_event_count":conversation_event_count,"llm_token_cost":llm_token_cost,"latest_usage_at":latest_usage_at,"days_since_last_usage":_days_since(latest_usage_at)}

def summarize_phase_k_signals(tenant_id, phase_k_metrics=None):
    metrics = phase_k_metrics or {}
    overview = metrics.get("overview", {}) if isinstance(metrics, dict) else {}
    funnel = metrics.get("funnel", {}) if isinstance(metrics, dict) else {}
    bookings = metrics.get("bookings", {}) if isinstance(metrics, dict) else {}
    booking_summary = bookings.get("summary", {}) if isinstance(bookings, dict) else {}
    return {"tenant_id":tenant_id,"total_sessions":_safe_int(overview.get("total_sessions",0)),"total_bookings":_safe_int(overview.get("total_bookings",0)),"total_revenue":_safe_float(overview.get("total_revenue",0)),"view_count":_safe_int(funnel.get("view",0)),"click_count":_safe_int(funnel.get("click",0)),"booking_count":_safe_int(funnel.get("booking",0)),"pending_bookings":_safe_int(booking_summary.get("pending",0)),"confirmed_bookings":_safe_int(booking_summary.get("confirmed",0)),"completed_bookings":_safe_int(booking_summary.get("completed",0))}

def build_usage_based_triggers(tenant_id, included_tokens, estimated_cost_per_action=1, config=None):
    config = {**DEFAULT_TRIGGER_CONFIG, **(config or {})}
    alert = build_usage_alert(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action)
    triggers = []
    level = alert.get("level", "safe")
    if level == "warning_70" and config["usage_warning_70_enabled"]:
        triggers.append(_build_trigger("usage_warning","medium","prepare_topup","usage reached 70 percent threshold",metadata={"alert":alert}))
    if level == "warning_85" and config["usage_warning_85_enabled"]:
        triggers.append(_build_trigger("usage_warning","high","topup_now","usage reached 85 percent threshold",metadata={"alert":alert}))
    if level == "critical_100" and config["usage_critical_100_enabled"]:
        triggers.append(_build_trigger("usage_critical","critical","force_topup","usage or wallet has reached critical threshold",should_block=True,metadata={"alert":alert}))
    return triggers

def build_wallet_based_triggers(tenant_id, config=None):
    config = {**DEFAULT_TRIGGER_CONFIG, **(config or {})}
    signals = summarize_usage_signals(tenant_id)
    triggers = []
    if config["wallet_low_balance_enabled"] and signals["wallet_balance_tokens"] <= 0:
        triggers.append(_build_trigger("wallet_empty","critical","force_topup","wallet balance is zero",should_block=True,metadata=signals))
    return triggers

def build_inactivity_triggers(tenant_id, config=None):
    config = {**DEFAULT_TRIGGER_CONFIG, **(config or {})}
    signals = summarize_usage_signals(tenant_id)
    triggers = []
    days = signals.get("days_since_last_usage")
    if config["inactivity_enabled"] and days is not None and days >= config["inactivity_days"]:
        triggers.append(_build_trigger("inactivity","medium","reengagement_promo",f"tenant inactive for {days} days",metadata=signals))
    return triggers

def build_booking_intent_triggers(tenant_id, phase_k_metrics=None, config=None):
    config = {**DEFAULT_TRIGGER_CONFIG, **(config or {})}
    signals = summarize_phase_k_signals(tenant_id, phase_k_metrics=phase_k_metrics)
    triggers = []
    if config["high_booking_intent_enabled"] and signals["pending_bookings"] >= config["high_booking_threshold"]:
        triggers.append(_build_trigger("high_booking_intent","high","upgrade_or_topup","high pending booking intent detected",metadata=signals))
    return triggers

def build_usage_triggers(tenant_id, included_tokens, estimated_cost_per_action=1, phase_k_metrics=None, config=None):
    all_triggers = (
        build_usage_based_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, config=config)
        + build_wallet_based_triggers(tenant_id=tenant_id, config=config)
        + build_inactivity_triggers(tenant_id=tenant_id, config=config)
        + build_booking_intent_triggers(tenant_id=tenant_id, phase_k_metrics=phase_k_metrics, config=config)
    )
    all_triggers.sort(key=lambda x: x.get("priority", 0), reverse=True)
    highest = all_triggers[0] if all_triggers else None
    return {"tenant_id":tenant_id,"trigger_count":len(all_triggers),"highest_priority_trigger":highest,"triggers":all_triggers,"generated_at":_now_iso()}

def validate_trigger_bundle(bundle):
    errors = []
    for field in ["tenant_id","trigger_count","triggers","generated_at"]:
        if field not in bundle: errors.append(f"missing field: {field}")
    if not isinstance(bundle.get("triggers",[]), list): errors.append("triggers must be a list")
    for idx, trigger in enumerate(bundle.get("triggers",[])):
        if not isinstance(trigger, dict): errors.append(f"trigger[{idx}] must be a dict"); continue
        for field in ["trigger_type","level","suggest_action","reason","priority","created_at"]:
            if field not in trigger: errors.append(f"trigger[{idx}] missing field: {field}")
        if trigger.get("level") not in {"low","medium","high","critical"}: errors.append(f"trigger[{idx}] invalid level")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    import sys
    sys.path.insert(0, "../phase_i")
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    print("=== USAGE TRIGGER ENGINE TEST ===")
    tenant = "tenant_h_demo"
    create_wallet(tenant)
    add_tokens(tenant, 1000, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":780,"ref_id":"req_h_001"})
    phase_k_metrics = {"overview":{"total_sessions":50,"total_bookings":6,"total_revenue":12000},"funnel":{"view":100,"click":30,"booking":6},"bookings":{"summary":{"pending":4,"confirmed":1,"completed":1}}}
    bundle = build_usage_triggers(tenant_id=tenant, included_tokens=1000, estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics)
    print(bundle)
    print(validate_trigger_bundle(bundle))
