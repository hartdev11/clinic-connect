from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from growth_api import get_growth_triggers, get_topup_recommendation, get_automated_promotions, get_funnel_analysis, get_growth_snapshot

DEFAULT_DECISION_CONFIG = {
    "critical_force_topup_score": 100,
    "high_topup_offer_score": 85,
    "upgrade_offer_score": 80,
    "promotion_offer_score": 70,
    "followup_offer_score": 65,
    "no_action_score": 10,
    "upgrade_trigger_min_pending_bookings": 3,
    "upgrade_trigger_min_total_bookings": 5,
    "low_payment_rate_threshold": 0.30,
    "low_booking_rate_threshold": 0.15,
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _safe_int(v):
    try: return int(v)
    except: return 0
def _priority_from_score(score):
    if score >= 90: return "critical"
    if score >= 75: return "high"
    if score >= 50: return "medium"
    return "low"
def _build_decision(action_type, score, reason, source, payload=None):
    return {"action_type":action_type,"score":score,"priority":_priority_from_score(score),"reason":reason,"source":source,"payload":payload or {},"created_at":_now_iso()}

def decide_force_topup(trigger_bundle, recommendation, config):
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    trigger_type = highest.get("trigger_type")
    level = highest.get("level")
    should_block = highest.get("should_block", False)
    if should_block or (trigger_type in {"usage_critical","wallet_empty"} and level == "critical"):
        return _build_decision("force_topup", config["critical_force_topup_score"], "wallet or usage is at critical level, system should force topup", "trigger_bundle", {"trigger":highest,"recommended_pack":recommendation.get("recommended_pack")})
    return None

def decide_topup_offer(trigger_bundle, recommendation, config):
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    level = highest.get("level")
    recommended_pack = recommendation.get("recommended_pack")
    should_recommend = recommendation.get("should_recommend", False)
    if recommended_pack and should_recommend and level in {"high","critical","medium"}:
        urgency = recommendation.get("urgency", "medium")
        base_score = config["high_topup_offer_score"]
        if urgency == "critical": base_score += 5
        elif urgency == "low": base_score -= 10
        return _build_decision("show_topup_offer", base_score, "tenant is likely to need more balance soon; recommend topup pack", "topup_recommendation", {"recommended_pack":recommended_pack,"urgency":urgency,"reason_detail":recommendation.get("reason")})
    return None

def decide_upgrade_offer(growth_snapshot, promotion_bundle, config):
    promotions = promotion_bundle.get("promotions", [])
    funnel_summary = growth_snapshot.get("funnel_summary", {}).get("result", {})
    triggers = growth_snapshot.get("growth_triggers", {}).get("result", {})
    total_bookings = _safe_int(funnel_summary.get("booking", 0))
    trigger_list = triggers.get("triggers", [])
    high_booking_intent = any(t.get("trigger_type") == "high_booking_intent" for t in trigger_list if isinstance(t, dict))
    has_upgrade_promo = next((p for p in promotions if p.get("type") == "plan_upgrade_discount"), None)
    if high_booking_intent or total_bookings >= config["upgrade_trigger_min_total_bookings"]:
        return _build_decision("show_upgrade_offer", config["upgrade_offer_score"], "tenant shows high booking intent or high booking volume; suggest plan upgrade", "promotion_automation", {"promotion":has_upgrade_promo,"total_bookings":total_bookings})
    return None

def decide_promotion_offer(promotion_bundle, config):
    promotions = promotion_bundle.get("promotions", [])
    if not promotions: return None
    first = promotions[0]
    return _build_decision("show_promotion", config["promotion_offer_score"], "automated promotion is available for this tenant", "promotion_automation", {"promotion":first,"promotion_count":promotion_bundle.get("promotion_count",0)})

def decide_followup_action(funnel_analysis, config):
    summary = funnel_analysis.get("funnel_summary", {})
    biggest_drop_stage = funnel_analysis.get("biggest_drop_stage")
    recommendations = funnel_analysis.get("recommendations", [])
    booking_rate = _safe_float(summary.get("booking_rate_from_click", 0))
    payment_rate = _safe_float(summary.get("payment_rate_from_booking", 0))
    if biggest_drop_stage in {"click_to_booking","booking_to_payment"}:
        if booking_rate < config["low_booking_rate_threshold"] or payment_rate < config["low_payment_rate_threshold"]:
            return _build_decision("trigger_followup", config["followup_offer_score"], "mid/bottom funnel drop detected; follow-up automation should be triggered", "funnel_analysis", {"biggest_drop_stage":biggest_drop_stage,"recommendations":recommendations[:2]})
    return None

def decide_no_action(config):
    return _build_decision("no_action", config["no_action_score"], "no urgent growth action is required", "decision_engine")

def build_growth_decisions(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None, channel=None, campaign_id=None, config=None):
    config = {**DEFAULT_DECISION_CONFIG, **(config or {})}
    trigger_bundle_block = get_growth_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    recommendation_block = get_topup_recommendation(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    promotion_block = get_automated_promotions(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    funnel_analysis_block = get_funnel_analysis(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    growth_snapshot = get_growth_snapshot(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id)
    trigger_bundle = trigger_bundle_block["result"]
    recommendation = recommendation_block["result"]
    promotion_bundle = promotion_block["result"]
    funnel_analysis = funnel_analysis_block["result"]
    decisions = []
    for builder in [
        lambda: decide_force_topup(trigger_bundle, recommendation, config),
        lambda: decide_topup_offer(trigger_bundle, recommendation, config),
        lambda: decide_upgrade_offer(growth_snapshot, promotion_bundle, config),
        lambda: decide_promotion_offer(promotion_bundle, config),
        lambda: decide_followup_action(funnel_analysis, config),
    ]:
        item = builder()
        if item is not None: decisions.append(item)
    if not decisions: decisions.append(decide_no_action(config))
    decisions.sort(key=lambda x: x.get("score", 0), reverse=True)
    return {"tenant_id":tenant_id,"decision_count":len(decisions),"next_best_action":decisions[0],"decisions":decisions,"context":{"growth_triggers":trigger_bundle,"topup_recommendation":recommendation,"promotion_bundle":promotion_bundle,"funnel_analysis":funnel_analysis},"generated_at":_now_iso()}

def validate_growth_decision_bundle(bundle):
    errors = []
    for field in ["tenant_id","decision_count","next_best_action","decisions","context","generated_at"]:
        if field not in bundle: errors.append(f"missing field: {field}")
    if not isinstance(bundle.get("decisions",[]), list): errors.append("decisions must be a list")
    if not isinstance(bundle.get("context",{}), dict): errors.append("context must be a dict")
    if not isinstance(bundle.get("next_best_action",{}), dict): errors.append("next_best_action must be a dict")
    for idx, item in enumerate(bundle.get("decisions",[])):
        if not isinstance(item, dict): errors.append(f"decisions[{idx}] must be a dict"); continue
        for field in ["action_type","score","priority","reason","source","payload","created_at"]:
            if field not in item: errors.append(f"decisions[{idx}] missing field: {field}")
        if item.get("priority") not in {"low","medium","high","critical"}: errors.append(f"decisions[{idx}] invalid priority")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
    print("=== GROWTH DECISION ENGINE TEST ===")
    tenant = "tenant_h_decision_demo"
    create_wallet(tenant)
    add_tokens(tenant, 700, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":620,"ref_id":"req_decision_001"})
    for _ in range(80): track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_decision")
    for _ in range(18): track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_decision")
    for i in range(4): track_phase_k_booking(tenant_id=tenant, booking_id=f"booking_decision_{i}", channel="line", campaign_id="cmp_decision", value=2500)
    track_payment_success(tenant_id=tenant, invoice_id="inv_decision_001", source_type="subscription", value=2500, channel="line")
    phase_k_metrics = {"overview":{"total_sessions":120,"total_bookings":8,"total_revenue":25000},"funnel":{"view":180,"click":45,"booking":8},"bookings":{"summary":{"pending":4,"confirmed":2,"completed":2}}}
    result = build_growth_decisions(tenant_id=tenant, included_tokens=1000, current_plan_id="growth", estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics, channel="line", campaign_id="cmp_decision")
    print(result)
    print(validate_growth_decision_bundle(result))
