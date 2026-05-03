from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4
from action_priority_engine import build_action_priority_plan, validate_action_priority_plan

ACTION_EXECUTION_LOGS: List[Dict[str, Any]] = []

DEFAULT_EXECUTION_CONFIG = {
    "execute_max_actions_per_cycle": 3,
    "allow_no_action_log": True,
    "force_topup_channel": "system_block",
    "topup_offer_channel": "ui_popup",
    "upgrade_offer_channel": "ui_popup",
    "promotion_channel": "promotion_inbox",
    "followup_channel": "crm_followup_queue",
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _generate_execution_id(): return f"exec_{uuid4().hex[:16]}"
def _safe_int(v):
    try: return int(v)
    except: return 0

def _build_execution_result(tenant_id, action, status, channel, result_payload=None):
    return {"execution_id":_generate_execution_id(),"tenant_id":tenant_id,"action_type":action.get("action_type"),"rank":action.get("rank"),"priority":action.get("priority"),"score":action.get("score"),"status":status,"channel":channel,"reason":action.get("reason"),"source":action.get("source"),"payload":action.get("payload",{}),"result_payload":result_payload or {},"executed_at":_now_iso()}

def _log_execution(item):
    ACTION_EXECUTION_LOGS.append(dict(item))
    return item

def execute_force_topup(tenant_id, action, config):
    payload = action.get("payload", {})
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="executed", channel=config["force_topup_channel"], result_payload={"message":"tenant must topup before continuing","should_block":True,"recommended_pack":payload.get("recommended_pack")}))

def execute_show_topup_offer(tenant_id, action, config):
    payload = action.get("payload", {})
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="executed", channel=config["topup_offer_channel"], result_payload={"offer_type":"topup","recommended_pack":payload.get("recommended_pack"),"urgency":payload.get("urgency"),"reason_detail":payload.get("reason_detail"),"display":"show_popup_or_banner"}))

def execute_show_upgrade_offer(tenant_id, action, config):
    payload = action.get("payload", {})
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="executed", channel=config["upgrade_offer_channel"], result_payload={"offer_type":"upgrade","promotion":payload.get("promotion"),"total_bookings":payload.get("total_bookings"),"display":"show_upgrade_modal"}))

def execute_show_promotion(tenant_id, action, config):
    payload = action.get("payload", {})
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="executed", channel=config["promotion_channel"], result_payload={"offer_type":"promotion","promotion":payload.get("promotion"),"promotion_count":payload.get("promotion_count",1),"display":"inject_promotion_to_ui_or_chat"}))

def execute_trigger_followup(tenant_id, action, config):
    payload = action.get("payload", {})
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="executed", channel=config["followup_channel"], result_payload={"queue_type":"followup","biggest_drop_stage":payload.get("biggest_drop_stage"),"recommendations":payload.get("recommendations",[]),"queued":True}))

def execute_no_action(tenant_id, action, config):
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="skipped", channel="none", result_payload={"message":"no action executed"}))

def execute_single_action(tenant_id, action, config=None):
    config = {**DEFAULT_EXECUTION_CONFIG, **(config or {})}
    action_type = action.get("action_type")
    if action_type == "force_topup": return execute_force_topup(tenant_id, action, config)
    if action_type == "show_topup_offer": return execute_show_topup_offer(tenant_id, action, config)
    if action_type == "show_upgrade_offer": return execute_show_upgrade_offer(tenant_id, action, config)
    if action_type == "show_promotion": return execute_show_promotion(tenant_id, action, config)
    if action_type == "trigger_followup": return execute_trigger_followup(tenant_id, action, config)
    if action_type == "no_action": return execute_no_action(tenant_id, action, config)
    return _log_execution(_build_execution_result(tenant_id=tenant_id, action=action, status="failed", channel="unknown", result_payload={"error":f"unsupported action_type: {action_type}"}))

def execute_action_plan(tenant_id, execution_plan, config=None):
    config = {**DEFAULT_EXECUTION_CONFIG, **(config or {})}
    priority_actions = execution_plan.get("priority_actions", [])
    max_actions = min(len(priority_actions), _safe_int(config["execute_max_actions_per_cycle"]))
    results = []
    executed_action_types = set()
    for action in priority_actions[:max_actions]:
        action_type = action.get("action_type")
        if action_type in executed_action_types: continue
        executed_action_types.add(action_type)
        results.append(execute_single_action(tenant_id=tenant_id, action=action, config=config))
    return {"tenant_id":tenant_id,"execution_count":len(results),"results":results,"executed_at":_now_iso()}

def build_and_execute_action_plan(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None, channel=None, campaign_id=None, priority_config=None, execution_config=None):
    priority_bundle = build_action_priority_plan(tenant_id=tenant_id, included_tokens=included_tokens, current_plan_id=current_plan_id, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics, channel=channel, campaign_id=campaign_id, config=priority_config)
    execution_plan = priority_bundle.get("execution_plan", {})
    execution_result = execute_action_plan(tenant_id=tenant_id, execution_plan=execution_plan, config=execution_config)
    return {"tenant_id":tenant_id,"priority_bundle":priority_bundle,"execution_result":execution_result,"generated_at":_now_iso()}

def get_execution_logs(tenant_id=None):
    if tenant_id is None: return ACTION_EXECUTION_LOGS
    return [x for x in ACTION_EXECUTION_LOGS if x.get("tenant_id") == tenant_id]

def validate_action_execution_bundle(bundle):
    errors = []
    for field in ["tenant_id","priority_bundle","execution_result","generated_at"]:
        if field not in bundle: errors.append(f"missing field: {field}")
    priority_bundle = bundle.get("priority_bundle", {})
    if not isinstance(priority_bundle, dict): errors.append("priority_bundle must be a dict")
    else:
        for err in validate_action_priority_plan(priority_bundle).get("errors",[]): errors.append(f"priority_bundle: {err}")
    execution_result = bundle.get("execution_result", {})
    if not isinstance(execution_result, dict): errors.append("execution_result must be a dict")
    else:
        for field in ["tenant_id","execution_count","results","executed_at"]:
            if field not in execution_result: errors.append(f"execution_result missing field: {field}")
        results = execution_result.get("results", [])
        if not isinstance(results, list): errors.append("execution_result.results must be a list")
        else:
            for idx, item in enumerate(results):
                if not isinstance(item, dict): errors.append(f"results[{idx}] must be a dict"); continue
                for field in ["execution_id","tenant_id","action_type","status","channel","reason","source","payload","result_payload","executed_at"]:
                    if field not in item: errors.append(f"results[{idx}] missing field: {field}")
                if item.get("status") not in {"executed","skipped","failed"}: errors.append(f"results[{idx}] invalid status")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
    print("=== ACTION EXECUTION ENGINE TEST ===")
    tenant = "tenant_h_execute_demo"
    create_wallet(tenant)
    add_tokens(tenant, 650, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":600,"ref_id":"req_execute_001"})
    for _ in range(100): track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_execute")
    for _ in range(20): track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_execute")
    for i in range(4): track_phase_k_booking(tenant_id=tenant, booking_id=f"booking_execute_{i}", channel="line", campaign_id="cmp_execute", value=2500)
    track_payment_success(tenant_id=tenant, invoice_id="inv_execute_001", source_type="subscription", value=2500, channel="line")
    phase_k_metrics = {"overview":{"total_sessions":140,"total_bookings":9,"total_revenue":26000},"funnel":{"view":210,"click":60,"booking":9},"bookings":{"summary":{"pending":4,"confirmed":3,"completed":2}}}
    result = build_and_execute_action_plan(tenant_id=tenant, included_tokens=1000, current_plan_id="growth", estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics, channel="line", campaign_id="cmp_execute")
    print(result)
    print(validate_action_execution_bundle(result))
    print(get_execution_logs(tenant))
