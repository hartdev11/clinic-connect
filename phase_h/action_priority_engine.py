from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from growth_decision_engine import build_growth_decisions, validate_growth_decision_bundle

DEFAULT_PRIORITY_CONFIG = {
    "max_actions_per_cycle": 3,
    "deduplicate_by_action_type": True,
    "allow_multiple_promotions": False,
    "critical_threshold": 90,
    "high_threshold": 75,
    "medium_threshold": 50,
    "topup_blocks_followup": True,
    "force_topup_blocks_all": True,
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_int(v):
    try: return int(v)
    except: return 0
def _priority_rank(priority):
    return {"critical":4,"high":3,"medium":2,"low":1}.get(priority, 0)
def _normalize_score(score, config):
    return max(0, min(_safe_int(score), 100))
def _build_prioritized_action(rank, action):
    return {"rank":rank,"action_type":action.get("action_type"),"priority":action.get("priority"),"score":action.get("score"),"reason":action.get("reason"),"source":action.get("source"),"payload":action.get("payload",{}),"created_at":action.get("created_at")}

def deduplicate_actions(decisions, config):
    if not config["deduplicate_by_action_type"]: return decisions
    seen = set()
    output = []
    for item in decisions:
        action_type = item.get("action_type")
        if action_type in seen: continue
        seen.add(action_type)
        output.append(item)
    return output

def apply_blocking_rules(decisions, config):
    if not decisions: return []
    action_types = {d.get("action_type") for d in decisions}
    if config["force_topup_blocks_all"] and "force_topup" in action_types:
        return [d for d in decisions if d.get("action_type") == "force_topup"]
    if config["topup_blocks_followup"] and "show_topup_offer" in action_types:
        return [d for d in decisions if d.get("action_type") != "trigger_followup"]
    return decisions

def apply_promotion_rules(decisions, config):
    if config["allow_multiple_promotions"]: return decisions
    promo_like = {"show_promotion","show_upgrade_offer"}
    promo_seen = False
    output = []
    for item in decisions:
        action_type = item.get("action_type")
        if action_type in promo_like:
            if promo_seen: continue
            promo_seen = True
        output.append(item)
    return output

def sort_decisions(decisions, config):
    return sorted(decisions, key=lambda x: (_normalize_score(x.get("score",0),config), _priority_rank(x.get("priority","low"))), reverse=True)

def build_execution_plan(decisions, config):
    working = sort_decisions(decisions, config)
    working = deduplicate_actions(working, config)
    working = apply_blocking_rules(working, config)
    working = apply_promotion_rules(working, config)
    working = sort_decisions(working, config)
    limited = working[:config["max_actions_per_cycle"]]
    prioritized = [_build_prioritized_action(rank=idx+1, action=item) for idx, item in enumerate(limited)]
    next_action = prioritized[0] if prioritized else None
    return {"action_count":len(prioritized),"next_action":next_action,"priority_actions":prioritized,"generated_at":_now_iso()}

def build_action_priority_plan(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None, channel=None, campaign_id=None, config=None):
    config = {**DEFAULT_PRIORITY_CONFIG, **(config or {})}
    decision_bundle = build_growth_decisions(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id)
    plan = build_execution_plan(decisions=decision_bundle.get("decisions",[]), config=config)
    return {"tenant_id":tenant_id,"decision_bundle":decision_bundle,"execution_plan":plan,"generated_at":_now_iso()}

def validate_action_priority_plan(bundle):
    errors = []
    for field in ["tenant_id","decision_bundle","execution_plan","generated_at"]:
        if field not in bundle: errors.append(f"missing field: {field}")
    decision_bundle = bundle.get("decision_bundle", {})
    if not isinstance(decision_bundle, dict): errors.append("decision_bundle must be a dict")
    else:
        for err in validate_growth_decision_bundle(decision_bundle).get("errors",[]): errors.append(f"decision_bundle: {err}")
    execution_plan = bundle.get("execution_plan", {})
    if not isinstance(execution_plan, dict): errors.append("execution_plan must be a dict")
    else:
        for field in ["action_count","priority_actions","generated_at"]:
            if field not in execution_plan: errors.append(f"execution_plan missing field: {field}")
        actions = execution_plan.get("priority_actions", [])
        if not isinstance(actions, list): errors.append("execution_plan.priority_actions must be a list")
        else:
            for idx, item in enumerate(actions):
                if not isinstance(item, dict): errors.append(f"priority_actions[{idx}] must be a dict"); continue
                for field in ["rank","action_type","priority","score","reason","source","payload"]:
                    if field not in item: errors.append(f"priority_actions[{idx}] missing field: {field}")
        next_action = execution_plan.get("next_action")
        if next_action is not None and not isinstance(next_action, dict): errors.append("execution_plan.next_action must be a dict or None")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
    print("=== ACTION PRIORITY ENGINE TEST ===")
    tenant = "tenant_h_priority_demo"
    create_wallet(tenant)
    add_tokens(tenant, 650, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":600,"ref_id":"req_priority_001"})
    for _ in range(90): track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_priority")
    for _ in range(20): track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_priority")
    for i in range(5): track_phase_k_booking(tenant_id=tenant, booking_id=f"booking_priority_{i}", channel="line", campaign_id="cmp_priority", value=2500)
    track_payment_success(tenant_id=tenant, invoice_id="inv_priority_001", source_type="subscription", value=2500, channel="line")
    phase_k_metrics = {"overview":{"total_sessions":130,"total_bookings":10,"total_revenue":28000},"funnel":{"view":200,"click":55,"booking":10},"bookings":{"summary":{"pending":5,"confirmed":3,"completed":2}}}
    result = build_action_priority_plan(tenant_id=tenant, included_tokens=1000, current_plan_id="growth", estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics, channel="line", campaign_id="cmp_priority")
    print(result)
    print(validate_action_priority_plan(result))
