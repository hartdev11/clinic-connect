from __future__ import annotations
import sys
from typing import Any, Dict, List
from wallet_manager import create_wallet, add_tokens, get_wallet
from usage_tracker import track_usage
from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
from growth_decision_engine import build_growth_decisions, validate_growth_decision_bundle
from action_priority_engine import build_action_priority_plan, validate_action_priority_plan
from action_execution_engine import build_and_execute_action_plan, validate_action_execution_bundle, get_execution_logs

def _print_header(title): print(f"\n=== {title} ===")
def _ok(msg): print(f"[PASS] {msg}")
def _fail(msg): print(f"[FAIL] {msg}")
def _collect(label, result, errors):
    if result.get("valid", False): _ok(label)
    else:
        _fail(label)
        for err in result.get("errors", []): errors.append(f"{label}: {err}"); print(f"  - {err}")

def _seed_funnel_data(tenant_id, channel, campaign_id, views, clicks, bookings, payments):
    for _ in range(views): track_phase_k_view(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    for _ in range(clicks): track_phase_k_click(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id, promotion_id="promo_h_check")
    for i in range(bookings): track_phase_k_booking(tenant_id=tenant_id, booking_id=f"{tenant_id}_booking_{i}", channel=channel, campaign_id=campaign_id, value=2500)
    for i in range(payments): track_payment_success(tenant_id=tenant_id, invoice_id=f"{tenant_id}_inv_{i}", source_type="subscription", value=2500, channel=channel, metadata={"campaign_id":campaign_id})

def _run_case(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action, phase_k_metrics, channel, campaign_id, expect_action_types, errors):
    _print_header(f"CASE: {tenant_id}")
    decision_bundle = build_growth_decisions(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id)
    _collect(f"{tenant_id} decision validation", validate_growth_decision_bundle(decision_bundle), errors)
    next_best_action = decision_bundle.get("next_best_action", {})
    if next_best_action.get("action_type") in expect_action_types: _ok(f"{tenant_id} expected decision action")
    else: _fail(f"{tenant_id} expected decision action"); errors.append(f"{tenant_id}: expected next_best_action in {expect_action_types}, got {next_best_action.get('action_type')}")
    priority_bundle = build_action_priority_plan(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id)
    _collect(f"{tenant_id} priority validation", validate_action_priority_plan(priority_bundle), errors)
    execution_plan = priority_bundle.get("execution_plan", {})
    next_action = execution_plan.get("next_action", {})
    if next_action and next_action.get("action_type") in expect_action_types: _ok(f"{tenant_id} expected priority next_action")
    else: _fail(f"{tenant_id} expected priority next_action"); errors.append(f"{tenant_id}: expected next_action in {expect_action_types}, got {next_action.get('action_type') if next_action else None}")
    execution_bundle = build_and_execute_action_plan(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id)
    _collect(f"{tenant_id} execution validation", validate_action_execution_bundle(execution_bundle), errors)
    execution_result = execution_bundle.get("execution_result", {})
    if execution_result.get("execution_count", 0) > 0: _ok(f"{tenant_id} execution_count > 0")
    else: _fail(f"{tenant_id} execution_count > 0"); errors.append(f"{tenant_id}: no action executed")
    logs = get_execution_logs(tenant_id)
    if len(logs) > 0: _ok(f"{tenant_id} execution logs created")
    else: _fail(f"{tenant_id} execution logs created"); errors.append(f"{tenant_id}: execution logs not created")
    executed_types = {item.get("action_type") for item in execution_result.get("results", [])}
    if len(executed_types) == len(execution_result.get("results", [])): _ok(f"{tenant_id} no duplicate action types in same cycle")
    else: _fail(f"{tenant_id} no duplicate action types in same cycle"); errors.append(f"{tenant_id}: duplicate action types executed in same cycle")

def main():
    errors = []
    INCLUDED_TOKENS = 1000
    CURRENT_PLAN_ID = "growth"
    ESTIMATED_COST_PER_ACTION = 10
    CHANNEL = "line"

    _print_header("PHASE H INTEGRATION CHECK")

    # CASE 1: HIGH USAGE -> SHOW_TOPUP_OFFER / FORCE_TOPUP
    tenant_1 = "tenant_h_check_topup"
    create_wallet(tenant_1)
    add_tokens(tenant_1, 700, source="seed")
    track_usage(tenant_id=tenant_1, usage_type="llm_tokens", payload={"tokens_used":620,"ref_id":"req_h_check_topup_001"})
    _seed_funnel_data(tenant_id=tenant_1, channel=CHANNEL, campaign_id="cmp_h_check_topup", views=50, clicks=15, bookings=3, payments=1)
    phase_k_metrics_1 = {"overview":{"total_sessions":100,"total_bookings":6,"total_revenue":18000},"funnel":{"view":160,"click":45,"booking":6},"bookings":{"summary":{"pending":3,"confirmed":2,"completed":1}}}
    _run_case(tenant_id=tenant_1, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics_1, channel=CHANNEL, campaign_id="cmp_h_check_topup", expect_action_types=["show_topup_offer","force_topup"], errors=errors)

    # CASE 2: CRITICAL BALANCE -> FORCE_TOPUP
    tenant_2 = "tenant_h_check_force"
    create_wallet(tenant_2)
    add_tokens(tenant_2, 100, source="seed")
    track_usage(tenant_id=tenant_2, usage_type="llm_tokens", payload={"tokens_used":100,"ref_id":"req_h_check_force_001"})
    _seed_funnel_data(tenant_id=tenant_2, channel=CHANNEL, campaign_id="cmp_h_check_force", views=30, clicks=8, bookings=1, payments=0)
    phase_k_metrics_2 = {"overview":{"total_sessions":40,"total_bookings":1,"total_revenue":0},"funnel":{"view":40,"click":10,"booking":1},"bookings":{"summary":{"pending":1,"confirmed":0,"completed":0}}}
    _run_case(tenant_id=tenant_2, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics_2, channel=CHANNEL, campaign_id="cmp_h_check_force", expect_action_types=["force_topup"], errors=errors)

    # CASE 3: FUNNEL DROP -> FOLLOWUP / PROMOTION
    tenant_3 = "tenant_h_check_followup"
    create_wallet(tenant_3)
    add_tokens(tenant_3, 2000, source="seed")
    track_usage(tenant_id=tenant_3, usage_type="llm_tokens", payload={"tokens_used":120,"ref_id":"req_h_check_followup_001"})
    _seed_funnel_data(tenant_id=tenant_3, channel=CHANNEL, campaign_id="cmp_h_check_followup", views=120, clicks=25, bookings=2, payments=0)
    phase_k_metrics_3 = {"overview":{"total_sessions":150,"total_bookings":2,"total_revenue":0},"funnel":{"view":200,"click":40,"booking":2},"bookings":{"summary":{"pending":2,"confirmed":0,"completed":0}}}
    _run_case(tenant_id=tenant_3, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics_3, channel=CHANNEL, campaign_id="cmp_h_check_followup", expect_action_types=["trigger_followup","show_promotion"], errors=errors)

    # CASE 4: HIGH BOOKING INTENT -> UPGRADE / PROMOTION
    tenant_4 = "tenant_h_check_upgrade"
    create_wallet(tenant_4)
    add_tokens(tenant_4, 1600, source="seed")
    track_usage(tenant_id=tenant_4, usage_type="llm_tokens", payload={"tokens_used":300,"ref_id":"req_h_check_upgrade_001"})
    _seed_funnel_data(tenant_id=tenant_4, channel=CHANNEL, campaign_id="cmp_h_check_upgrade", views=90, clicks=35, bookings=8, payments=3)
    phase_k_metrics_4 = {"overview":{"total_sessions":180,"total_bookings":10,"total_revenue":30000},"funnel":{"view":220,"click":70,"booking":10},"bookings":{"summary":{"pending":5,"confirmed":3,"completed":2}}}
    _run_case(tenant_id=tenant_4, included_tokens=INCLUDED_TOKENS, current_plan_id=CURRENT_PLAN_ID, estimated_cost_per_action=ESTIMATED_COST_PER_ACTION, phase_k_metrics=phase_k_metrics_4, channel=CHANNEL, campaign_id="cmp_h_check_upgrade", expect_action_types=["show_upgrade_offer","show_promotion"], errors=errors)

    _print_header("FINAL RESULT")
    if not errors:
        _ok("decision engine integration ผ่าน")
        _ok("priority engine integration ผ่าน")
        _ok("execution engine integration ผ่าน")
        _ok("topup / force / followup / upgrade scenarios ผ่าน")
        _ok("execution logs created correctly")
        print("\nFINAL RESULT: PASS — PHASE H INTEGRATION COMPLETE")
        return 0
    _fail("one or more integration checks failed")
    for err in errors: print(f"  - {err}")
    print("\nFINAL RESULT: FAIL — PHASE H INTEGRATION NOT COMPLETE")
    return 1

if __name__ == "__main__":
    sys.exit(main())
