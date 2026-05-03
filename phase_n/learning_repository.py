from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from conversation_logger import list_conversations, get_session_conversations
from outcome_tracker import list_outcomes, get_outcome_by_session, summarize_outcomes
from decision_logger import list_decisions, get_session_decisions, summarize_decisions
from experiment_tracker import list_experiment_logs, summarize_experiments_by_type

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()

def get_conversations_bundle(tenant_id=None, clinic_id=None, branch_id=None, channel=None, session_id=None, intent=None, procedure_recommended=None, model_used=None, limit=200):
    items = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel=channel, session_id=session_id, intent=intent, procedure_recommended=procedure_recommended, model_used=model_used, limit=limit)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"channel":channel,"session_id":session_id,"items":items,"count":len(items),"generated_at":_now_iso()}

def get_outcomes_bundle(tenant_id=None, clinic_id=None, branch_id=None, session_id=None, conversion_status=None, paid=None, booking=None, source_channel=None, limit=200):
    items = list_outcomes(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, session_id=session_id, conversion_status=conversion_status, paid=paid, booking=booking, source_channel=source_channel, limit=limit)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"session_id":session_id,"items":items,"count":len(items),"generated_at":_now_iso()}

def get_decisions_bundle(tenant_id=None, clinic_id=None, branch_id=None, session_id=None, decision_type=None, selected_option=None, intent=None, model_used=None, cost_tier=None, limit=200):
    items = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, session_id=session_id, decision_type=decision_type, selected_option=selected_option, intent=intent, model_used=model_used, cost_tier=cost_tier, limit=limit)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"session_id":session_id,"items":items,"count":len(items),"generated_at":_now_iso()}

def get_experiment_results_bundle(tenant_id=None, clinic_id=None, branch_id=None, experiment_id=None, experiment_type=None, variant_id=None, session_id=None, result=None, channel=None, limit=200):
    items = list_experiment_logs(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, experiment_id=experiment_id, experiment_type=experiment_type, variant_id=variant_id, session_id=session_id, result=result, channel=channel, limit=limit)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"experiment_id":experiment_id,"experiment_type":experiment_type,"items":items,"count":len(items),"generated_at":_now_iso()}

def get_session_learning_bundle(session_id):
    conversations = get_session_conversations(session_id)
    outcome = get_outcome_by_session(session_id)
    decisions = get_session_decisions(session_id)
    experiments = list_experiment_logs(session_id=session_id, limit=500)
    return {"session_id":session_id,"conversation_count":len(conversations),"decision_count":len(decisions),"experiment_count":len(experiments),"conversations":conversations,"outcome":outcome,"decisions":decisions,"experiments":experiments,"generated_at":_now_iso()}

def get_clinic_learning_bundle(tenant_id, clinic_id, branch_id=None, channel=None, limit_per_source=500):
    conversations = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel=channel, limit=limit_per_source)
    outcomes = list_outcomes(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, source_channel=channel, limit=limit_per_source)
    decisions = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, limit=limit_per_source)
    experiments = list_experiment_logs(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel=channel, limit=limit_per_source)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"channel":channel,"conversations":conversations,"outcomes":outcomes,"decisions":decisions,"experiments":experiments,"summary":{"conversation_count":len(conversations),"outcome_count":len(outcomes),"decision_count":len(decisions),"experiment_count":len(experiments)},"generated_at":_now_iso()}

def get_channel_learning_bundle(tenant_id, channel, clinic_id=None, limit_per_source=500):
    conversations = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel, limit=limit_per_source)
    outcomes = list_outcomes(tenant_id=tenant_id, clinic_id=clinic_id, source_channel=channel, limit=limit_per_source)
    decisions = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, limit=limit_per_source)
    experiments = list_experiment_logs(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel, limit=limit_per_source)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":_normalize_text(channel),"conversations":conversations,"outcomes":outcomes,"decisions":decisions,"experiments":experiments,"summary":{"conversation_count":len(conversations),"outcome_count":len(outcomes),"decision_count":len(decisions),"experiment_count":len(experiments)},"generated_at":_now_iso()}

def get_model_performance_bundle(tenant_id, model_used, clinic_id=None, limit_per_source=500):
    conversations = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, model_used=model_used, limit=limit_per_source)
    decisions = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, model_used=model_used, limit=limit_per_source)
    session_ids = {x.get("session_id") for x in conversations if x.get("session_id")}
    outcomes = []
    for sid in session_ids:
        outcome = get_outcome_by_session(sid)
        if outcome: outcomes.append(outcome)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"model_used":model_used,"conversations":conversations,"decisions":decisions,"outcomes":outcomes,"summary":{"conversation_count":len(conversations),"decision_count":len(decisions),"outcome_count":len(outcomes)},"generated_at":_now_iso()}

def get_prompt_variant_bundle(tenant_id, prompt_version, clinic_id=None, limit_per_source=500):
    conversations = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, limit=limit_per_source)
    conversations = [x for x in conversations if x.get("prompt_version") == prompt_version]
    decisions = list_decisions(tenant_id=tenant_id, clinic_id=clinic_id, limit=limit_per_source)
    decisions = [x for x in decisions if x.get("prompt_version") == prompt_version]
    session_ids = {x.get("session_id") for x in conversations if x.get("session_id")}
    outcomes = []
    for sid in session_ids:
        outcome = get_outcome_by_session(sid)
        if outcome: outcomes.append(outcome)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"prompt_version":prompt_version,"conversations":conversations,"decisions":decisions,"outcomes":outcomes,"summary":{"conversation_count":len(conversations),"decision_count":len(decisions),"outcome_count":len(outcomes)},"generated_at":_now_iso()}

def build_learning_repository_summary(tenant_id, clinic_id=None, branch_id=None, channel=None):
    conversation_bundle = get_conversations_bundle(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel=channel, limit=100000)
    outcome_summary = summarize_outcomes(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, source_channel=channel)
    decision_summary = summarize_decisions(tenant_id=tenant_id, clinic_id=clinic_id)
    experiment_summary = summarize_experiments_by_type(tenant_id=tenant_id)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"channel":channel,"conversation_summary":{"count":conversation_bundle["count"]},"outcome_summary":outcome_summary,"decision_summary":decision_summary,"experiment_summary":experiment_summary,"generated_at":_now_iso()}

def validate_learning_bundle(bundle):
    errors = []
    if "generated_at" not in bundle: errors.append("missing generated_at")
    if "session_id" in bundle:
        for field in ["conversations","outcome","decisions","experiments"]:
            if field not in bundle: errors.append(f"missing {field}")
    if "items" in bundle and not isinstance(bundle.get("items"), list): errors.append("items must be a list")
    for possible in ["conversations","decisions","experiments","outcomes"]:
        if possible in bundle and not isinstance(bundle.get(possible), list) and bundle.get(possible) is not None: errors.append(f"{possible} must be a list")
    if "summary" in bundle and not isinstance(bundle.get("summary"), dict): errors.append("summary must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversation_logger import log_conversation
    from outcome_tracker import track_outcome
    from decision_logger import log_decision
    from experiment_tracker import track_experiment
    print("=== LEARNING REPOSITORY TEST ===")
    log_conversation(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_001", user_message="botox ราคาเท่าไหร่", ai_response="มีโปร Botox ค่ะ", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.0021, prompt_version="pv_001")
    track_outcome(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, source_channel="line")
    log_decision(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", decision_type="offer_selection", selected_option="botox", options_considered=["botox","filler"], score=0.9, confidence=0.88, reason="pricing intent + high demand", model_used="gpt-4o-mini", channel="line", intent="pricing", prompt_version="pv_001")
    track_experiment(experiment_id="exp_cta_001", variant_id="cta_B", experiment_type="cta", session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, channel="line", intent="pricing", prompt_version="pv_001")
    session_bundle = get_session_learning_bundle("s_001")
    print("SESSION BUNDLE:", session_bundle["conversation_count"], session_bundle["decision_count"])
    print("SESSION VALID:", validate_learning_bundle(session_bundle))
    clinic_bundle = get_clinic_learning_bundle("t_001", "c_001")
    print("CLINIC BUNDLE:", clinic_bundle["summary"])
    summary = build_learning_repository_summary("t_001", clinic_id="c_001")
    print("REPO SUMMARY:", summary)
