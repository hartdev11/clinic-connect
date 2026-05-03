from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

LEARNING_POLICY_EVALUATIONS: List[Dict[str, Any]] = []
LEARNING_POLICY_BLOCK_LOGS: List[Dict[str, Any]] = []

DEFAULT_POLICY_CONFIG = {
    "safe_to_auto_apply_by_default": False,
    "require_review_for_prompt_changes": True,
    "require_review_for_recommendation_changes": True,
    "require_review_for_cta_aggression_increase": True,
    "require_review_for_medical_wording_changes": True,
    "block_if_hallucinated_procedure_detected": True,
    "block_if_inventory_mismatch_detected": True,
    "block_if_unsafe_claim_detected": True,
    "block_if_aggressive_cta_detected": True,
    "allow_auto_apply_only_for_low_risk_style_changes": True,
    "high_risk_change_types": ["increase_cta_aggression","medical_wording_change","unsafe_claim_risk","inventory_override","procedure_priority_change","trust_claim_increase"],
    "unsafe_keywords": ["guaranteed result","100% result","ไม่มีผลข้างเคียงแน่นอน","ปลอดภัย 100%","หายแน่นอน"],
    "aggressive_keywords": ["ต้องจองตอนนี้","รีบจ่ายตอนนี้","ห้ามพลาดเด็ดขาด","ซื้อทันที"],
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(v):
    if v is None: return ""
    return str(v).strip().lower()
def _safe_dict(v): return v if isinstance(v, dict) else {}
def _safe_list(v): return v if isinstance(v, list) else []
def _safe_bool(v):
    if isinstance(v, bool): return v
    if isinstance(v, str): return _normalize_text(v) in {"true","1","yes","y"}
    if isinstance(v, (int,float)): return v != 0
    return False
def _generate_evaluation_id(): return f"lpe_{uuid4().hex[:16]}"
def _generate_block_id(): return f"lpb_{uuid4().hex[:16]}"
def _contains_any_keyword(text, keywords):
    normalized = _normalize_text(text)
    return any(_normalize_text(k) in normalized for k in keywords)

def detect_hallucinated_procedure_risk(suggestion, clinic_inventory=None):
    clinic_inventory = clinic_inventory or []
    prioritized = _safe_list(suggestion.get("prioritized_items"))
    deprioritized = _safe_list(suggestion.get("deprioritized_items"))
    all_items = [str(x) for x in prioritized + deprioritized]
    if not clinic_inventory: return {"triggered":False,"reason":"no_inventory_provided"}
    unknown = [x for x in all_items if x not in clinic_inventory]
    if unknown: return {"triggered":True,"reason":"inventory_mismatch","unknown_items":unknown}
    return {"triggered":False,"reason":"ok"}

def detect_unsafe_claim_risk(suggestion, config):
    text_parts = [str(suggestion.get("reason","")), str(suggestion.get("change_type","")), str(suggestion.get("target",""))]
    joined = " | ".join(text_parts)
    if _contains_any_keyword(joined, _safe_list(config.get("unsafe_keywords"))): return {"triggered":True,"reason":"unsafe_claim_keyword_detected"}
    return {"triggered":False,"reason":"ok"}

def detect_aggressive_cta_risk(suggestion, config):
    text_parts = [str(suggestion.get("reason","")), str(suggestion.get("change_type",""))]
    joined = " | ".join(text_parts)
    if _contains_any_keyword(joined, _safe_list(config.get("aggressive_keywords"))): return {"triggered":True,"reason":"aggressive_cta_keyword_detected"}
    change_type = _normalize_text(suggestion.get("change_type"))
    if "aggression" in change_type or "hard_close" in change_type: return {"triggered":True,"reason":"aggressive_cta_change_type_detected"}
    return {"triggered":False,"reason":"ok"}

def detect_high_risk_change(suggestion, config):
    change_type = _normalize_text(suggestion.get("change_type"))
    high_risk_change_types = [_normalize_text(x) for x in _safe_list(config.get("high_risk_change_types"))]
    if change_type in high_risk_change_types: return {"triggered":True,"reason":"high_risk_change_type"}
    suggestion_type = _normalize_text(suggestion.get("suggestion_type"))
    if suggestion_type in {"procedure_priority_optimization","offer_strategy_optimization"}: return {"triggered":True,"reason":"recommendation_reorder_is_high_risk"}
    return {"triggered":False,"reason":"ok"}

def evaluate_learning_suggestion_policy(suggestion, clinic_inventory=None, tenant_policy=None):
    config = {**DEFAULT_POLICY_CONFIG, **(tenant_policy or {})}
    suggestion_type = _normalize_text(suggestion.get("suggestion_type"))
    change_type = _normalize_text(suggestion.get("change_type"))
    hallucination_risk = detect_hallucinated_procedure_risk(suggestion=suggestion, clinic_inventory=clinic_inventory)
    unsafe_claim_risk = detect_unsafe_claim_risk(suggestion=suggestion, config=config)
    aggressive_cta_risk = detect_aggressive_cta_risk(suggestion=suggestion, config=config)
    high_risk_change = detect_high_risk_change(suggestion=suggestion, config=config)
    block_reasons = []; review_reasons = []
    if hallucination_risk["triggered"] and config.get("block_if_inventory_mismatch_detected",True): block_reasons.append(hallucination_risk["reason"])
    if unsafe_claim_risk["triggered"] and config.get("block_if_unsafe_claim_detected",True): block_reasons.append(unsafe_claim_risk["reason"])
    if aggressive_cta_risk["triggered"] and config.get("block_if_aggressive_cta_detected",True): block_reasons.append(aggressive_cta_risk["reason"])
    if high_risk_change["triggered"]: review_reasons.append(high_risk_change["reason"])
    if suggestion_type in {"prompt_version_improvement","channel_style_improvement","trust_proof_improvement"}:
        if config.get("require_review_for_prompt_changes",True): review_reasons.append("prompt_change_requires_review")
    if suggestion_type in {"procedure_priority_optimization","offer_strategy_optimization"}:
        if config.get("require_review_for_recommendation_changes",True): review_reasons.append("recommendation_change_requires_review")
    if "cta" in suggestion_type and config.get("require_review_for_cta_aggression_increase",True):
        if "aggression" in change_type or "cta" in change_type: review_reasons.append("cta_change_requires_review")
    if "medical" in change_type and config.get("require_review_for_medical_wording_changes",True): review_reasons.append("medical_wording_requires_review")
    decision = "allow_review"; safe_to_auto_apply = False
    if block_reasons:
        decision = "blocked"; safe_to_auto_apply = False
    else:
        if not review_reasons and config.get("allow_auto_apply_only_for_low_risk_style_changes",True):
            suggestion_type_ok = suggestion_type in {"channel_style_improvement","cta_improvement"}
            low_risk_change = change_type in {"shorten_responses","reduce_drop_risk","prioritize_top_cta","deprioritize_weak_cta"}
            if suggestion_type_ok and low_risk_change:
                decision = "auto_apply_candidate"; safe_to_auto_apply = bool(config.get("safe_to_auto_apply_by_default",False))
    evaluation = {"evaluation_id":_generate_evaluation_id(),"tenant_id":suggestion.get("tenant_id"),"clinic_id":suggestion.get("clinic_id"),"suggestion_id":suggestion.get("suggestion_id"),"suggestion_type":suggestion_type,"change_type":change_type,"decision":decision,"safe_to_auto_apply":safe_to_auto_apply,"block_reasons":list(dict.fromkeys(block_reasons)),"review_reasons":list(dict.fromkeys(review_reasons)),"risk_checks":{"hallucination_risk":hallucination_risk,"unsafe_claim_risk":unsafe_claim_risk,"aggressive_cta_risk":aggressive_cta_risk,"high_risk_change":high_risk_change},"created_at":_now_iso()}
    LEARNING_POLICY_EVALUATIONS.append(evaluation)
    if decision == "blocked":
        LEARNING_POLICY_BLOCK_LOGS.append({"block_id":_generate_block_id(),"tenant_id":suggestion.get("tenant_id"),"clinic_id":suggestion.get("clinic_id"),"suggestion_id":suggestion.get("suggestion_id"),"suggestion_type":suggestion_type,"block_reasons":list(dict.fromkeys(block_reasons)),"created_at":_now_iso()})
    return evaluation

def evaluate_learning_package_policy(suggestions, clinic_inventory=None, tenant_policy=None):
    evaluations = [evaluate_learning_suggestion_policy(suggestion=item, clinic_inventory=clinic_inventory, tenant_policy=tenant_policy) for item in suggestions]
    decision_counts = {}
    for item in evaluations:
        decision = item.get("decision","unknown"); decision_counts[decision] = decision_counts.get(decision,0) + 1
    return {"evaluation_count":len(evaluations),"decision_counts":decision_counts,"evaluations":evaluations,"generated_at":_now_iso()}

def list_policy_evaluations(tenant_id=None, clinic_id=None, decision=None, suggestion_type=None, limit=100):
    results = []
    for item in reversed(LEARNING_POLICY_EVALUATIONS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if decision and item.get("decision") != _normalize_text(decision): continue
        if suggestion_type and item.get("suggestion_type") != _normalize_text(suggestion_type): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def list_policy_blocks(tenant_id=None, clinic_id=None, suggestion_type=None, limit=100):
    results = []
    for item in reversed(LEARNING_POLICY_BLOCK_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if suggestion_type and item.get("suggestion_type") != _normalize_text(suggestion_type): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def validate_policy_evaluation(item):
    errors = []
    for field in ["evaluation_id","suggestion_id","suggestion_type","change_type","decision","safe_to_auto_apply","block_reasons","review_reasons","risk_checks","created_at"]:
        if field not in item: errors.append(f"missing {field}")
    if item.get("decision") not in {"blocked","allow_review","auto_apply_candidate"}: errors.append("invalid decision")
    if not isinstance(item.get("block_reasons",[]), list): errors.append("block_reasons must be a list")
    if not isinstance(item.get("review_reasons",[]), list): errors.append("review_reasons must be a list")
    if not isinstance(item.get("risk_checks",{}), dict): errors.append("risk_checks must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

def validate_policy_package(package):
    errors = []
    for field in ["evaluation_count","decision_counts","evaluations","generated_at"]:
        if field not in package: errors.append(f"missing {field}")
    if not isinstance(package.get("evaluations",[]), list): errors.append("evaluations must be a list")
    if not isinstance(package.get("decision_counts",{}), dict): errors.append("decision_counts must be a dict")
    for idx, item in enumerate(package.get("evaluations",[])):
        result = validate_policy_evaluation(item)
        if not result["valid"]:
            for err in result["errors"]: errors.append(f"evaluations[{idx}]: {err}")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from prompt_improvement_engine import _build_suggestion as build_prompt_suggestion
    from recommendation_optimizer import _build_suggestion as build_reco_suggestion
    print("=== LEARNING POLICY GUARD TEST ===")
    safe_prompt = build_prompt_suggestion(tenant_id="t_001", clinic_id="c_001", suggestion_type="channel_style_improvement", target="channel_response_style", change_type="shorten_responses", reason="LINE should prefer shorter responses", confidence=0.78, channel="line")
    risky_prompt = build_prompt_suggestion(tenant_id="t_001", clinic_id="c_001", suggestion_type="cta_improvement", target="cta_prompt_rules", change_type="increase_cta_aggression", reason="ต้องจองตอนนี้เพื่อไม่พลาด", confidence=0.82, channel="line")
    eval_1 = evaluate_learning_suggestion_policy(suggestion=safe_prompt, clinic_inventory=["proc_botox","proc_filler"])
    print("EVAL 1:", eval_1["decision"])
    print("VALID 1:", validate_policy_evaluation(eval_1))
    eval_2 = evaluate_learning_suggestion_policy(suggestion=risky_prompt, clinic_inventory=["proc_botox","proc_filler"])
    print("EVAL 2:", eval_2["decision"])
    package = evaluate_learning_package_policy(suggestions=[safe_prompt,risky_prompt], clinic_inventory=["proc_botox","proc_filler"])
    print("PACKAGE VALID:", validate_policy_package(package))
