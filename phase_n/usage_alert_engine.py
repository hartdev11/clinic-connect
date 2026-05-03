from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from wallet_manager import get_wallet
from usage_tracker import get_usage_logs

ALERT_LEVELS = {"safe", "warning_70", "warning_85", "critical_100"}
DEFAULT_THRESHOLDS = {"warning_70": 0.70, "warning_85": 0.85, "critical_100": 1.00}

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _safe_int(v):
    try: return int(v)
    except: return 0

def _pick_level(usage_percent, thresholds):
    if usage_percent >= thresholds["critical_100"]: return "critical_100"
    if usage_percent >= thresholds["warning_85"]: return "warning_85"
    if usage_percent >= thresholds["warning_70"]: return "warning_70"
    return "safe"

def _sum_usage_cost(usage_logs):
    return sum(_safe_int(item.get("cost", 0)) for item in usage_logs)

def evaluate_quota_alert(used, limit, thresholds=None):
    thresholds = thresholds or DEFAULT_THRESHOLDS
    used = max(0, _safe_int(used))
    limit = max(0, _safe_int(limit))
    usage_percent = (used / limit) if limit > 0 else 0.0
    level = _pick_level(usage_percent, thresholds)
    return {"type":"quota","level":level,"used":used,"limit":limit,"usage_percent":round(usage_percent,4),"remaining":max(limit-used,0),"timestamp":_now_iso()}

def evaluate_wallet_alert(balance_tokens, estimated_cost_per_action=1, low_balance_actions_70=50, low_balance_actions_85=20):
    balance_tokens = max(0, _safe_int(balance_tokens))
    estimated_cost_per_action = max(1, _safe_int(estimated_cost_per_action))
    remaining_actions = balance_tokens // estimated_cost_per_action
    if balance_tokens <= 0: level = "critical_100"
    elif remaining_actions <= low_balance_actions_85: level = "warning_85"
    elif remaining_actions <= low_balance_actions_70: level = "warning_70"
    else: level = "safe"
    return {"type":"wallet","level":level,"balance_tokens":balance_tokens,"estimated_cost_per_action":estimated_cost_per_action,"remaining_actions":remaining_actions,"timestamp":_now_iso()}

def evaluate_combined_alert(quota_alert, wallet_alert):
    priority = {"safe":0,"warning_70":1,"warning_85":2,"critical_100":3}
    quota_level = quota_alert.get("level","safe")
    wallet_level = wallet_alert.get("level","safe")
    final_level = quota_level if priority.get(quota_level,0) >= priority.get(wallet_level,0) else wallet_level
    return {"level":final_level,"quota_alert":quota_alert,"wallet_alert":wallet_alert,"should_topup":final_level in {"warning_85","critical_100"},"should_block":final_level=="critical_100","timestamp":_now_iso()}

def build_alert_message(level):
    if level == "safe": return "ระบบยังใช้งานได้ปกติ"
    if level == "warning_70": return "คุณใช้ไปแล้วมากกว่า 70% แนะนำให้เตรียมเติมเงิน"
    if level == "warning_85": return "คุณใช้ไปมากกว่า 85% ใกล้หมดแล้ว กรุณาเติมเงิน"
    if level == "critical_100": return "ยอดใช้งานหมดแล้ว กรุณาเติมเงินเพื่อใช้งานต่อ"
    return "ไม่สามารถระบุสถานะได้"

def build_usage_alert(tenant_id, included_tokens, estimated_cost_per_action=1, thresholds=None):
    wallet = get_wallet(tenant_id)
    usage_logs = get_usage_logs(tenant_id)
    balance_tokens = _safe_int(wallet.get("balance_tokens", 0))
    total_used_tokens = _sum_usage_cost(usage_logs)
    quota_alert = evaluate_quota_alert(used=total_used_tokens, limit=included_tokens, thresholds=thresholds)
    wallet_alert = evaluate_wallet_alert(balance_tokens=balance_tokens, estimated_cost_per_action=estimated_cost_per_action)
    combined = evaluate_combined_alert(quota_alert=quota_alert, wallet_alert=wallet_alert)
    return {"tenant_id":tenant_id,"level":combined["level"],"should_topup":combined["should_topup"],"should_block":combined["should_block"],"quota_alert":quota_alert,"wallet_alert":wallet_alert,"message":build_alert_message(combined["level"]),"timestamp":_now_iso()}

def validate_alert(alert):
    errors = []
    if alert.get("level") not in ALERT_LEVELS: errors.append("invalid alert level")
    if "tenant_id" not in alert: errors.append("missing tenant_id")
    if "should_topup" not in alert: errors.append("missing should_topup")
    if "should_block" not in alert: errors.append("missing should_block")
    if not isinstance(alert.get("quota_alert",{}), dict): errors.append("quota_alert must be a dict")
    if not isinstance(alert.get("wallet_alert",{}), dict): errors.append("wallet_alert must be a dict")
    if "message" not in alert: errors.append("missing message")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    print("=== USAGE ALERT ENGINE TEST ===")
    tenant = "tenant_001"
    create_wallet(tenant)
    add_tokens(tenant, 1000)
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":300,"ref_id":"req_001"})
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":450,"ref_id":"req_002"})
    alert = build_usage_alert(tenant_id=tenant, included_tokens=1000, estimated_cost_per_action=10)
    print(alert)
    print(validate_alert(alert))
