from __future__ import annotations
import sys
from typing import Any, Dict, List
from wallet_manager import create_wallet, add_tokens
from usage_tracker import track_usage
from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
from usage_trigger_engine import build_usage_triggers, validate_trigger_bundle
from topup_recommendation_engine import build_topup_recommendation, validate_topup_recommendation
from promotion_automation_engine import build_automated_promotions, validate_automated_promotion_bundle
from conversion_tracker import summarize_funnel, validate_funnel_summary
from funnel_analyzer import analyze_funnel, validate_funnel_analysis
from growth_api import get_growth_triggers, get_topup_recommendation, get_automated_promotions, get_funnel_summary, get_funnel_analysis, get_growth_snapshot, get_priority_growth_action
from growth_validator import validate_growth_bundle

def _print_header(title): print(f"\n=== {title} ===")
def _ok(msg): print(f"[PASS] {msg}")
def _fail(msg): print(f"[FAIL] {msg}")
def _collect(label, result, errors):
    if result.get("valid", False): _ok(label)
    else:
        _fail(label)
        for err in result.get("errors", []): errors.append(f"{label}: {err}"); print(f"  - {err}")

def main():
    errors = []
    TENANT_ID = "tenant_phase_h_final"
    INCLUDED_TOKENS = 1000
    CURRENT_PLAN_ID = "growth"
    ESTIMATED_COST_PER_ACTION = 10
    CHANNEL = "line"
    CAMPAIGN_ID = "cmp_phase_h_final"

    _print_header("PHASE H FINAL CHECK")

    _print_header("STEP 0 - PRELOAD PHASE I STATE")
    create_wallet(TENANT_ID)
    add_tokens(TENANT_ID, 900, source="seed")
    track_usage(tenant_id=TENANT_ID, usage_type="llm_tokens", payload={"tokens_used":650,"ref_id":"req_h_final_001"})
    track_usage(tenant_id=TENANT_ID, usage_type="llm_tokens", payload={"tokens_used":120,"ref_id":"req_h_final_002"})
    _ok("phase i wallet/usage state preloaded")

    _print_header("STEP 1 - PRELOAD PHASE K FUNNEL STATE")
    for _ in range(120): track_phase_k_view(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    for _ in range(32): track_phase_k_click(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID, promotion_id="promo_phase_h")
    for i in range(7): track_phase_k_booking(tenant_id=TENANT_ID, booking_id=f"booking_phase_h_{i}", channel=CHANNEL, campaign_id=CAMPAIGN_ID, value=2500)
    for i in range(2): track_payment_success(tenant_id=TENANT_ID, invoice_id=f"inv_phase_h_{i}", source_type="subscription", value=2500, channel=CHANNEL, metadata={"campaign_id":CAMPAIGN_ID})
    _ok("phase k funnel state preloaded")

    phase_k_metrics = {"overview":{"total_sessions":150,"total_bookings":9,"total_revenue":35000},"funnel":{"view":240,"click":60,"booking":9},"bookings":{"summary":{"pending":5,"confirmed":2,"completed":2}}}

    _print_header("STEP 2 - USAGE TRIGGER ENGINE")
    trigger_bundle = build_usage_triggers(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    _collect("trigger bundle validation", validate_trigger_bundle(trigger_bundle), errors)
    if trigger_bundle.get("trigger_count", 0) > 0: _ok("at least one trigger generated")
    else: _fail("at least one trigger generated"); errors.append("expected at least one trigger")

    _print_header("STEP 3 - TOPUP RECOMMENDATION ENGINE")
    recommendation = build_topup_recommendation(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    _collect("topup recommendation validation", validate_topup_recommendation(recommendation), errors)
    if recommendation.get("recommended_pack") is not None: _ok("recommended pack generated")
    else: _fail("recommended pack generated"); errors.append("expected recommended pack")

    _print_header("STEP 4 - PROMOTION AUTOMATION ENGINE")
    promotion_bundle = build_automated_promotions(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    _collect("promotion automation validation", validate_automated_promotion_bundle(promotion_bundle), errors)
    if promotion_bundle.get("promotion_count", 0) > 0: _ok("automated promotion generated")
    else: _fail("automated promotion generated"); errors.append("expected at least one automated promotion")

    _print_header("STEP 5 - CONVERSION TRACKER")
    funnel_summary = summarize_funnel(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    _collect("funnel summary validation", validate_funnel_summary(funnel_summary), errors)
    if funnel_summary.get("view", 0) > 0: _ok("funnel summary has views")
    else: _fail("funnel summary has views"); errors.append("expected view > 0")

    _print_header("STEP 6 - FUNNEL ANALYZER")
    funnel_analysis = analyze_funnel(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    _collect("funnel analysis validation", validate_funnel_analysis(funnel_analysis), errors)
    if len(funnel_analysis.get("recommendations", [])) > 0: _ok("funnel analysis produced recommendations")
    else: _fail("funnel analysis produced recommendations"); errors.append("expected at least one funnel recommendation")

    _print_header("STEP 7 - GROWTH API")
    api_triggers = get_growth_triggers(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    api_recommendation = get_topup_recommendation(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    api_promotions = get_automated_promotions(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    api_funnel_summary = get_funnel_summary(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    api_funnel_analysis = get_funnel_analysis(tenant_id=TENANT_ID, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    growth_snapshot = get_growth_snapshot(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics, channel=CHANNEL, campaign_id=CAMPAIGN_ID)
    priority_action = get_priority_growth_action(tenant_id=TENANT_ID, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics)
    if isinstance(growth_snapshot, dict): _ok("growth snapshot generated")
    else: _fail("growth snapshot generated"); errors.append("growth snapshot must be dict")
    if priority_action.get("action_type") in {"force_topup","show_topup_offer","show_promotion","no_action"}: _ok("priority action generated")
    else: _fail("priority action generated"); errors.append("invalid priority action")

    _print_header("STEP 8 - GROWTH VALIDATOR")
    bundle_validation = validate_growth_bundle(
        trigger_bundle=api_triggers["result"],
        recommendation=api_recommendation["result"],
        promotion_bundle=api_promotions["result"],
        funnel_summary=api_funnel_summary["result"],
        funnel_analysis=api_funnel_analysis["result"],
        growth_snapshot=growth_snapshot,
        priority_action=priority_action,
    )
    _collect("growth bundle validation", bundle_validation, errors)

    _print_header("FINAL RESULT")
    if not errors:
        _ok("usage trigger flow ผ่าน")
        _ok("topup recommendation flow ผ่าน")
        _ok("promotion automation flow ผ่าน")
        _ok("conversion tracking flow ผ่าน")
        _ok("funnel analysis flow ผ่าน")
        _ok("growth api flow ผ่าน")
        _ok("growth validator flow ผ่าน")
        print("\nFINAL RESULT: PASS — PHASE H COMPLETE")
        return 0
    _fail("one or more checks failed")
    for err in errors: print(f"  - {err}")
    print("\nFINAL RESULT: FAIL — PHASE H NOT COMPLETE")
    return 1

if __name__ == "__main__":
    sys.exit(main())
