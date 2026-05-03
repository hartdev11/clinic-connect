from __future__ import annotations
from typing import Any, Dict, Optional
from usage_trigger_engine import build_usage_triggers, validate_trigger_bundle
from topup_recommendation_engine import build_topup_recommendation, validate_topup_recommendation
from promotion_automation_engine import build_automated_promotions, validate_automated_promotion_bundle
from conversion_tracker import summarize_funnel, validate_funnel_summary
from funnel_analyzer import analyze_funnel, validate_funnel_analysis

def get_growth_triggers(tenant_id, included_tokens, estimated_cost_per_action=1, phase_k_metrics=None):
    result = build_usage_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    return {"result": result, "validation": validate_trigger_bundle(result)}

def get_topup_recommendation(tenant_id, included_tokens, estimated_cost_per_action=1, phase_k_metrics=None):
    result = build_topup_recommendation(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    return {"result": result, "validation": validate_topup_recommendation(result)}

def get_automated_promotions(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None):
    result = build_automated_promotions(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    return {"result": result, "validation": validate_automated_promotion_bundle(result)}

def get_funnel_summary(tenant_id, channel=None, campaign_id=None):
    result = summarize_funnel(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    return {"result": result, "validation": validate_funnel_summary(result)}

def get_funnel_analysis(tenant_id, channel=None, campaign_id=None):
    result = analyze_funnel(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    return {"result": result, "validation": validate_funnel_analysis(result)}

def get_growth_snapshot(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None, channel=None, campaign_id=None):
    return {
        "tenant_id": tenant_id,
        "growth_triggers": get_growth_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics),
        "topup_recommendation": get_topup_recommendation(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics),
        "automated_promotions": get_automated_promotions(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics),
        "funnel_summary": get_funnel_summary(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id),
        "funnel_analysis": get_funnel_analysis(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id),
    }

def get_priority_growth_action(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None):
    snapshot = get_growth_snapshot(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    triggers_result = snapshot["growth_triggers"]["result"]
    topup_result = snapshot["topup_recommendation"]["result"]
    promo_result = snapshot["automated_promotions"]["result"]
    highest_trigger = triggers_result.get("highest_priority_trigger")
    recommended_pack = topup_result.get("recommended_pack")
    promotions = promo_result.get("promotions", [])
    if highest_trigger and highest_trigger.get("should_block"):
        return {"action_type":"force_topup","priority":"critical","trigger":highest_trigger,"recommended_pack":recommended_pack,"promotion":promotions[0] if promotions else None}
    if recommended_pack and topup_result.get("should_recommend"):
        return {"action_type":"show_topup_offer","priority":topup_result.get("urgency","medium"),"recommended_pack":recommended_pack,"promotion":promotions[0] if promotions else None,"reason":topup_result.get("reason")}
    if promotions:
        return {"action_type":"show_promotion","priority":"medium","promotion":promotions[0]}
    return {"action_type":"no_action","priority":"low","reason":"no immediate growth action required"}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
    print("=== GROWTH API TEST ===")
    tenant = "tenant_h6_demo"
    create_wallet(tenant)
    add_tokens(tenant, 800, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":650,"ref_id":"req_h6_001"})
    for _ in range(50): track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_h6")
    for _ in range(15): track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_h6")
    for i in range(3): track_phase_k_booking(tenant_id=tenant, booking_id=f"booking_h6_{i}", channel="line", campaign_id="cmp_h6", value=2500)
    track_payment_success(tenant_id=tenant, invoice_id="inv_h6_0", source_type="subscription", value=2500, channel="line")
    phase_k_metrics = {"overview":{"total_sessions":90,"total_bookings":7,"total_revenue":18000},"funnel":{"view":140,"click":45,"booking":7},"bookings":{"summary":{"pending":4,"confirmed":2,"completed":1}}}
    print(get_priority_growth_action(tenant_id=tenant, included_tokens=1000, current_plan_id="growth", estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics))
