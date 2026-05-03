from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

DECISION_LOGS: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip()
def _normalize_text_lower(value): return _normalize_text(value).lower()
def _safe_dict(value): return value if isinstance(value, dict) else {}
def _safe_list(value): return value if isinstance(value, list) else []
def _safe_float(value):
    try: return float(value)
    except: return 0.0
def _generate_decision_id(): return f"dec_{uuid4().hex[:16]}"

def log_decision(session_id, tenant_id, clinic_id, branch_id, decision_type, selected_option, options_considered=None, score=None, confidence=None, reason=None, model_used=None, channel=None, intent=None, ranked_options=None, rejected_options=None, policy_flags=None, safety_flags=None, cost_tier=None, prompt_version=None, rule_version=None, inventory_snapshot_id=None, metadata=None):
    record = {"decision_id":_generate_decision_id(),"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"decision_type":_normalize_text_lower(decision_type),"selected_option":_normalize_text(selected_option),"options_considered":_safe_list(options_considered),"score":round(_safe_float(score),6) if score is not None else None,"confidence":round(_safe_float(confidence),6) if confidence is not None else None,"reason":_normalize_text(reason),"model_used":_normalize_text(model_used),"channel":_normalize_text_lower(channel) if channel else None,"intent":_normalize_text_lower(intent) if intent else None,"ranked_options":_safe_list(ranked_options),"rejected_options":_safe_list(rejected_options),"policy_flags":[_normalize_text_lower(x) for x in _safe_list(policy_flags)],"safety_flags":[_normalize_text_lower(x) for x in _safe_list(safety_flags)],"cost_tier":_normalize_text_lower(cost_tier) if cost_tier else None,"prompt_version":prompt_version,"rule_version":rule_version,"inventory_snapshot_id":inventory_snapshot_id,"metadata":_safe_dict(metadata),"created_at":_now_iso()}
    DECISION_LOGS.append(record)
    return record

def list_decisions(tenant_id=None, clinic_id=None, branch_id=None, session_id=None, decision_type=None, selected_option=None, intent=None, model_used=None, cost_tier=None, limit=100):
    results = []
    for item in reversed(DECISION_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if branch_id and item.get("branch_id") != branch_id: continue
        if session_id and item.get("session_id") != session_id: continue
        if decision_type and item.get("decision_type") != _normalize_text_lower(decision_type): continue
        if selected_option and item.get("selected_option") != _normalize_text(selected_option): continue
        if intent and item.get("intent") != _normalize_text_lower(intent): continue
        if model_used and item.get("model_used") != _normalize_text(model_used): continue
        if cost_tier and item.get("cost_tier") != _normalize_text_lower(cost_tier): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def get_decision(decision_id):
    for item in DECISION_LOGS:
        if item.get("decision_id") == decision_id: return item
    return None

def get_session_decisions(session_id):
    return [x for x in DECISION_LOGS if x.get("session_id") == session_id]

def summarize_decisions(tenant_id=None, clinic_id=None, decision_type=None):
    items = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, decision_type=decision_type, limit=100000)
    by_decision_type = {}; by_selected_option = {}; by_model = {}; by_cost_tier = {}
    policy_flag_counts = {}; safety_flag_counts = {}
    total_score = 0.0; total_confidence = 0.0; score_count = 0; confidence_count = 0
    for item in items:
        d_type = item.get("decision_type") or "unknown"
        selected = item.get("selected_option") or "unknown"
        model = item.get("model_used") or "unknown"
        cost_tier = item.get("cost_tier") or "unknown"
        by_decision_type[d_type] = by_decision_type.get(d_type,0) + 1
        by_selected_option[selected] = by_selected_option.get(selected,0) + 1
        by_model[model] = by_model.get(model,0) + 1
        by_cost_tier[cost_tier] = by_cost_tier.get(cost_tier,0) + 1
        if item.get("score") is not None: total_score += _safe_float(item["score"]); score_count += 1
        if item.get("confidence") is not None: total_confidence += _safe_float(item["confidence"]); confidence_count += 1
        for flag in item.get("policy_flags",[]): policy_flag_counts[flag] = policy_flag_counts.get(flag,0) + 1
        for flag in item.get("safety_flags",[]): safety_flag_counts[flag] = safety_flag_counts.get(flag,0) + 1
    avg_score = round(total_score/score_count,6) if score_count > 0 else None
    avg_confidence = round(total_confidence/confidence_count,6) if confidence_count > 0 else None
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"decision_type_filter":decision_type,"total_decisions":len(items),"by_decision_type":by_decision_type,"by_selected_option":by_selected_option,"by_model":by_model,"by_cost_tier":by_cost_tier,"policy_flag_counts":policy_flag_counts,"safety_flag_counts":safety_flag_counts,"average_score":avg_score,"average_confidence":avg_confidence,"generated_at":_now_iso()}

def build_decision_intelligence_package(session_id):
    items = get_session_decisions(session_id)
    if not items: return {"session_id":session_id,"exists":False,"decision_count":0,"latest_decision":None,"all_decisions":[],"generated_at":_now_iso()}
    latest = sorted(items, key=lambda x: x.get("created_at",""))[-1]
    return {"session_id":session_id,"exists":True,"decision_count":len(items),"latest_decision":latest,"all_decisions":items,"generated_at":_now_iso()}

def validate_decision_record(record):
    errors = []
    for field in ["decision_id","session_id","tenant_id","decision_type","selected_option","options_considered","reason","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if not record.get("decision_type"): errors.append("empty decision_type")
    if not record.get("selected_option"): errors.append("empty selected_option")
    if not isinstance(record.get("options_considered",[]), list): errors.append("options_considered must be a list")
    if not isinstance(record.get("ranked_options",[]), list): errors.append("ranked_options must be a list")
    if not isinstance(record.get("rejected_options",[]), list): errors.append("rejected_options must be a list")
    if not isinstance(record.get("policy_flags",[]), list): errors.append("policy_flags must be a list")
    if not isinstance(record.get("safety_flags",[]), list): errors.append("safety_flags must be a list")
    if record.get("score") is not None and _safe_float(record["score"]) < 0: errors.append("score cannot be negative")
    if record.get("confidence") is not None:
        c = _safe_float(record["confidence"])
        if c < 0 or c > 1: errors.append("confidence must be between 0 and 1")
    return {"valid": len(errors)==0, "errors": errors}

def validate_decision_intelligence_package(package):
    errors = []
    for field in ["session_id","exists","decision_count","latest_decision","all_decisions","generated_at"]:
        if field not in package: errors.append(f"missing {field}")
    if not isinstance(package.get("all_decisions",[]), list): errors.append("all_decisions must be a list")
    if package.get("exists") and package.get("decision_count",0) <= 0: errors.append("decision_count must be > 0 when exists=true")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== DECISION LOGGER TEST ===")
    r1 = log_decision(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", decision_type="offer_selection", selected_option="botox", options_considered=["botox","filler","ulthera"], score=0.87, confidence=0.91, reason="pricing intent + clinic inventory + conversion pattern", model_used="gpt-4.1-mini", channel="line", intent="pricing", ranked_options=["botox","filler","ulthera"], rejected_options=["ulthera"], policy_flags=["inventory_checked"], safety_flags=["safe"], cost_tier="medium", prompt_version="pv_001", rule_version="rv_002", inventory_snapshot_id="inv_001")
    print("LOG:", r1)
    print("VALID:", validate_decision_record(r1))
    pkg = build_decision_intelligence_package("s_001")
    print("PACKAGE:", pkg)
    print("PACKAGE VALID:", validate_decision_intelligence_package(pkg))
