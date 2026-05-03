from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4
from learning_repository import get_session_learning_bundle
from prompt_improvement_engine import list_prompt_improvement_suggestions
from recommendation_optimizer import list_recommendation_optimization_suggestions

LEARNING_FEEDBACK_LOGS: List[Dict[str, Any]] = []
LEARNING_APPROVAL_LOGS: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(v):
    if v is None: return ""
    return str(v).strip().lower()
def _safe_dict(v): return v if isinstance(v, dict) else {}
def _safe_bool(v):
    if isinstance(v, bool): return v
    if isinstance(v, str): return _normalize_text(v) in {"true","1","yes","y"}
    if isinstance(v, (int,float)): return v != 0
    return False
def _safe_list(v): return v if isinstance(v, list) else []
def _generate_feedback_id(): return f"lfb_{uuid4().hex[:16]}"
def _generate_approval_id(): return f"lap_{uuid4().hex[:16]}"

def submit_learning_feedback(session_id, tenant_id, reviewer_user_id, clinic_id=None, branch_id=None, feedback_type="session_review", thumbs_up=None, thumbs_down=None, answer_quality=None, recommendation_quality=None, sales_outcome_quality=None, flagged_unsafe=False, flagged_hallucination=False, flagged_aggressive=False, needs_followup_review=False, comment=None, labels=None, metadata=None):
    record = {"feedback_id":_generate_feedback_id(),"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"reviewer_user_id":reviewer_user_id,"feedback_type":_normalize_text(feedback_type),"thumbs_up":thumbs_up if thumbs_up is None else _safe_bool(thumbs_up),"thumbs_down":thumbs_down if thumbs_down is None else _safe_bool(thumbs_down),"answer_quality":_normalize_text(answer_quality) if answer_quality else None,"recommendation_quality":_normalize_text(recommendation_quality) if recommendation_quality else None,"sales_outcome_quality":_normalize_text(sales_outcome_quality) if sales_outcome_quality else None,"flagged_unsafe":_safe_bool(flagged_unsafe),"flagged_hallucination":_safe_bool(flagged_hallucination),"flagged_aggressive":_safe_bool(flagged_aggressive),"needs_followup_review":_safe_bool(needs_followup_review),"comment":comment.strip() if isinstance(comment,str) else comment,"labels":[_normalize_text(x) for x in _safe_list(labels)],"metadata":_safe_dict(metadata),"created_at":_now_iso()}
    LEARNING_FEEDBACK_LOGS.append(record)
    return record

def submit_suggestion_review(tenant_id, reviewer_user_id, suggestion_id, suggestion_source, decision, clinic_id=None, comment=None, rollback_required=False, metadata=None):
    record = {"approval_id":_generate_approval_id(),"tenant_id":tenant_id,"clinic_id":clinic_id,"reviewer_user_id":reviewer_user_id,"suggestion_id":suggestion_id,"suggestion_source":_normalize_text(suggestion_source),"decision":_normalize_text(decision),"comment":comment.strip() if isinstance(comment,str) else comment,"rollback_required":_safe_bool(rollback_required),"metadata":_safe_dict(metadata),"created_at":_now_iso()}
    LEARNING_APPROVAL_LOGS.append(record)
    return record

def get_learning_session_review(session_id):
    session_bundle = get_session_learning_bundle(session_id)
    feedback_items = [x for x in LEARNING_FEEDBACK_LOGS if x.get("session_id") == session_id]
    return {"session_id":session_id,"session_bundle":session_bundle,"feedback_items":feedback_items,"feedback_count":len(feedback_items),"generated_at":_now_iso()}

def get_learning_summary(tenant_id, clinic_id=None):
    feedback_items = [x for x in LEARNING_FEEDBACK_LOGS if x.get("tenant_id") == tenant_id and (not clinic_id or x.get("clinic_id") == clinic_id)]
    thumbs_up_count = sum(1 for x in feedback_items if x.get("thumbs_up") is True)
    thumbs_down_count = sum(1 for x in feedback_items if x.get("thumbs_down") is True)
    unsafe_count = sum(1 for x in feedback_items if x.get("flagged_unsafe"))
    hallucination_count = sum(1 for x in feedback_items if x.get("flagged_hallucination"))
    aggressive_count = sum(1 for x in feedback_items if x.get("flagged_aggressive"))
    followup_count = sum(1 for x in feedback_items if x.get("needs_followup_review"))
    label_counts = {}
    for item in feedback_items:
        for label in item.get("labels",[]): label_counts[label] = label_counts.get(label,0) + 1
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"total_feedback":len(feedback_items),"thumbs_up_count":thumbs_up_count,"thumbs_down_count":thumbs_down_count,"unsafe_count":unsafe_count,"hallucination_count":hallucination_count,"aggressive_count":aggressive_count,"followup_review_count":followup_count,"label_counts":label_counts,"generated_at":_now_iso()}

def get_learning_suggestions(tenant_id, clinic_id=None, limit=100):
    prompt_suggestions = list_prompt_improvement_suggestions(tenant_id=tenant_id, clinic_id=clinic_id, limit=limit)
    recommendation_suggestions = list_recommendation_optimization_suggestions(tenant_id=tenant_id, clinic_id=clinic_id, limit=limit)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"prompt_suggestions":prompt_suggestions,"recommendation_suggestions":recommendation_suggestions,"generated_at":_now_iso()}

def approve_learning_suggestion(tenant_id, reviewer_user_id, suggestion_id, suggestion_source, clinic_id=None, comment=None, metadata=None):
    return submit_suggestion_review(tenant_id=tenant_id, reviewer_user_id=reviewer_user_id, suggestion_id=suggestion_id, suggestion_source=suggestion_source, decision="approve", clinic_id=clinic_id, comment=comment, metadata=metadata)

def reject_learning_suggestion(tenant_id, reviewer_user_id, suggestion_id, suggestion_source, clinic_id=None, comment=None, metadata=None):
    return submit_suggestion_review(tenant_id=tenant_id, reviewer_user_id=reviewer_user_id, suggestion_id=suggestion_id, suggestion_source=suggestion_source, decision="reject", clinic_id=clinic_id, comment=comment, metadata=metadata)

def list_learning_feedback(tenant_id=None, clinic_id=None, session_id=None, reviewer_user_id=None, feedback_type=None, limit=100):
    results = []
    for item in reversed(LEARNING_FEEDBACK_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if session_id and item.get("session_id") != session_id: continue
        if reviewer_user_id and item.get("reviewer_user_id") != reviewer_user_id: continue
        if feedback_type and item.get("feedback_type") != _normalize_text(feedback_type): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def list_learning_approval_logs(tenant_id=None, clinic_id=None, suggestion_source=None, decision=None, reviewer_user_id=None, limit=100):
    results = []
    for item in reversed(LEARNING_APPROVAL_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if suggestion_source and item.get("suggestion_source") != _normalize_text(suggestion_source): continue
        if decision and item.get("decision") != _normalize_text(decision): continue
        if reviewer_user_id and item.get("reviewer_user_id") != reviewer_user_id: continue
        results.append(item)
        if len(results) >= limit: break
    return results

def validate_learning_feedback_record(record):
    errors = []
    for field in ["feedback_id","session_id","tenant_id","reviewer_user_id","feedback_type","flagged_unsafe","flagged_hallucination","flagged_aggressive","needs_followup_review","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if not isinstance(record.get("labels",[]), list): errors.append("labels must be a list")
    return {"valid": len(errors)==0, "errors": errors}

def validate_learning_approval_record(record):
    errors = []
    for field in ["approval_id","tenant_id","reviewer_user_id","suggestion_id","suggestion_source","decision","rollback_required","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if record.get("decision") not in {"approve","reject","needs_revision","rollback"}: errors.append("invalid decision")
    return {"valid": len(errors)==0, "errors": errors}

def validate_learning_feedback_package(package):
    errors = []
    if "generated_at" not in package: errors.append("missing generated_at")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversation_logger import log_conversation
    from outcome_tracker import track_outcome
    from prompt_improvement_engine import build_prompt_improvement_suggestions
    print("=== LEARNING FEEDBACK API TEST ===")
    log_conversation(session_id="s_401", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_401", user_message="botox ราคาเท่าไหร่", ai_response="มีโปรค่ะ", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.002, prompt_version="pv_001")
    track_outcome(session_id="s_401", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=False, revenue=0, source_channel="line")
    prompt_pkg = build_prompt_improvement_suggestions(tenant_id="t_001", clinic_id="c_001", channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"], persist=True)
    feedback = submit_learning_feedback(session_id="s_401", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", reviewer_user_id="u_owner_001", feedback_type="session_review", thumbs_up=True, answer_quality="good", flagged_unsafe=False, flagged_hallucination=False, flagged_aggressive=False, needs_followup_review=False, comment="ตอบดี", labels=["pricing"])
    print("FEEDBACK:", feedback)
    print("FEEDBACK VALID:", validate_learning_feedback_record(feedback))
    if prompt_pkg.get("suggestions"):
        approval = approve_learning_suggestion(tenant_id="t_001", clinic_id="c_001", reviewer_user_id="u_owner_001", suggestion_id=prompt_pkg["suggestions"][0]["suggestion_id"], suggestion_source="prompt_improvement", comment="approved")
        print("APPROVAL:", approval)
        print("APPROVAL VALID:", validate_learning_approval_record(approval))
    print("SUMMARY:", get_learning_summary("t_001","c_001"))
