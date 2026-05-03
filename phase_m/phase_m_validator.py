from __future__ import annotations
import sys
from typing import Any, Dict, List
from cost_calculator import log_and_calculate_cost, get_cost_logs
from model_router import route_model, validate_routing_result
from prompt_optimizer import build_optimized_prompt_package, validate_prompt_package
from response_cache import get_or_set_cached_response, get_cache_stats, validate_cache_item
from budget_controller import check_budget_control, get_budget_decision, validate_budget_control_result, validate_budget_decision
from cost_aggregator import build_cost_aggregation_package, validate_cost_aggregation_package
from cost_alert_engine import build_cost_alert_package, validate_cost_alert_package
from fallback_engine import build_fallback_plan, apply_fallback_plan, validate_fallback_plan, validate_applied_payload
from cost_api import get_cost_dashboard, process_request, validate_cost_dashboard

def _ok(msg): print(f"[PASS] {msg}")
def _fail(msg): print(f"[FAIL] {msg}")
def _header(title): print(f"\n=== {title} ===")

def _collect(label, result, errors):
    if result.get("valid", False): _ok(label)
    else:
        _fail(label)
        for err in result.get("errors", []): errors.append(f"{label}: {err}"); print(f"  - {err}")

def main():
    errors = []
    TENANT = "tenant_m_final"
    CLINIC = "clinic_1"

    _header("PHASE M VALIDATOR")

    _header("STEP 1 - TOKEN USAGE + COST LOGGING")
    r1 = log_and_calculate_cost(tenant_id=TENANT, clinic_id=CLINIC, session_id="sess_m_001",
        model="gpt-4.1", input_tokens=3000, output_tokens=5000, channel="line", feature="closing_assist")
    r2 = log_and_calculate_cost(tenant_id=TENANT, clinic_id=CLINIC, session_id="sess_m_002",
        model="gpt-4o-mini", input_tokens=200, output_tokens=400, channel="website", feature="faq_assist")
    logs = get_cost_logs(tenant_id=TENANT)
    if len(logs) >= 2: _ok("cost logs created")
    else: _fail("cost logs created"); errors.append("expected >= 2 cost logs")
    if r1.get("total_cost", 0) > 0: _ok("cost calculated correctly")
    else: _fail("cost calculated correctly"); errors.append("total_cost must be > 0")

    _header("STEP 2 - MODEL ROUTER")
    route_ok = route_model(feature="faq_assist", budget_status="ok")
    route_crit = route_model(feature="closing_assist", budget_status="critical")
    _collect("routing ok validation", validate_routing_result(route_ok), errors)
    _collect("routing critical validation", validate_routing_result(route_crit), errors)
    if route_ok.get("selected_model"): _ok("model selected for ok budget")
    else: _fail("model selected"); errors.append("no model selected")
    if route_crit.get("downgraded"): _ok("model downgraded on critical budget")
    else: _fail("model downgraded on critical"); errors.append("expected downgrade on critical")

    _header("STEP 3 - PROMPT OPTIMIZER")
    pkg = build_optimized_prompt_package(
        intent="faq",
        system_prompt="You are an AI sales assistant for a beauty clinic. Help answer questions and guide toward booking.",
        history_messages=[{"role":"user","content":"สวัสดี"},{"role":"assistant","content":"สวัสดีค่ะ"}],
        context_payload={"procedure_info":{"botox":"reduces wrinkles"},"clinic_info":{"name":"Demo"},"promotion_info":{"promo":"10% off"}},
    )
    _collect("prompt package validation", validate_prompt_package(pkg), errors)
    if pkg.get("system_prompt"): _ok("system prompt optimized")
    else: _fail("system prompt optimized"); errors.append("system prompt is empty")

    _header("STEP 4 - RESPONSE CACHE")
    write_result = get_or_set_cached_response(
        user_message="Botox ช่วยอะไร", intent="faq",
        response_text="Botox ช่วยลดริ้วรอยค่ะ",
        procedure="botox", feature="faq_assist", clinic_id=CLINIC, model="gpt-4o-mini",
    )
    read_result = get_or_set_cached_response(
        user_message="Botox ช่วยอะไร", intent="faq",
        procedure="botox", feature="faq_assist", clinic_id=CLINIC,
    )
    if write_result.get("cached_item"): _collect("cache item validation", validate_cache_item(write_result["cached_item"]), errors)
    if read_result.get("cache_hit"): _ok("cache hit on second call")
    else: _fail("cache hit on second call"); errors.append("expected cache hit")
    stats = get_cache_stats()
    if stats.get("total_items", 0) > 0: _ok("cache stats available")
    else: _fail("cache stats"); errors.append("cache should have items")

    _header("STEP 5 - BUDGET CONTROLLER")
    budget_result = check_budget_control(tenant_id=TENANT, clinic_id=CLINIC, projected_request_cost=0.001)
    _collect("budget control validation", validate_budget_control_result(budget_result), errors)
    decision = get_budget_decision(tenant_id=TENANT, clinic_id=CLINIC, projected_request_cost=0.001)
    _collect("budget decision validation", validate_budget_decision(decision), errors)
    if isinstance(decision.get("should_proceed"), bool): _ok("budget decision has should_proceed")
    else: _fail("budget decision should_proceed"); errors.append("should_proceed must be bool")

    _header("STEP 6 - COST AGGREGATOR")
    package = build_cost_aggregation_package(tenant_id=TENANT, clinic_id=CLINIC)
    _collect("cost aggregation package validation", validate_cost_aggregation_package(package), errors)
    if package.get("summary", {}).get("total_requests", 0) > 0: _ok("cost aggregation has requests")
    else: _fail("cost aggregation requests"); errors.append("expected > 0 requests in aggregation")

    _header("STEP 7 - COST ALERT ENGINE")
    alert_pkg = build_cost_alert_package(tenant_id=TENANT, clinic_id=CLINIC, projected_request_cost=0.001)
    _collect("cost alert package validation", validate_cost_alert_package(alert_pkg), errors)
    if "budget_status" in alert_pkg: _ok("alert package has budget_status")
    else: _fail("alert package budget_status"); errors.append("missing budget_status in alert package")

    _header("STEP 8 - FALLBACK ENGINE")
    fallback_plan = build_fallback_plan(tenant_id=TENANT, clinic_id=CLINIC,
        current_model="gpt-4.1", feature="closing_assist", projected_request_cost=0.001)
    _collect("fallback plan validation", validate_fallback_plan(fallback_plan), errors)
    request_payload = {"model":"gpt-4.1","max_response_tokens":700,"max_context_items":8,"feature":"closing_assist"}
    applied = apply_fallback_plan(request_payload, fallback_plan)
    _collect("applied payload validation", validate_applied_payload(applied), errors)

    _header("STEP 9 - COST API")
    dashboard = get_cost_dashboard(tenant_id=TENANT, clinic_id=CLINIC)
    _collect("cost dashboard validation", validate_cost_dashboard(dashboard), errors)
    process_result = process_request(tenant_id=TENANT, clinic_id=CLINIC, session_id="sess_m_final",
        feature="faq_assist", user_message="Botox ช่วยอะไร", intent="faq", projected_cost=0.001)
    if process_result.get("status") in {"proceed","cache_hit","blocked"}: _ok("process_request returned valid status")
    else: _fail("process_request status"); errors.append("invalid process_request status")

    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL\n")
        for e in errors: print(f"  - {e}")
        return 1
    print("FINAL RESULT: PASS — PHASE M COMPLETE")
    return 0

if __name__ == "__main__":
    sys.exit(main())
