from __future__ import annotations
from typing import Any, Dict
from conversation_logger import log_conversation, validate_conversation_record
from outcome_tracker import track_outcome, validate_outcome_record, build_learning_label_package, validate_learning_label_package
from decision_logger import log_decision, validate_decision_record, build_decision_intelligence_package, validate_decision_intelligence_package
from experiment_tracker import track_experiment, validate_experiment_record, summarize_experiment, validate_experiment_summary
from learning_repository import get_session_learning_bundle, validate_learning_bundle
from learning_analyzer import build_learning_analysis_summary, validate_learning_analysis_summary
from prompt_improvement_engine import build_prompt_improvement_suggestions, validate_prompt_improvement_package
from recommendation_optimizer import build_recommendation_optimization_package, validate_recommendation_optimization_package
from learning_feedback_api import submit_learning_feedback, validate_learning_feedback_record, approve_learning_suggestion, validate_learning_approval_record
from learning_policy_guard import evaluate_learning_package_policy, validate_policy_package

def _print_result(name, result):
    status = "PASS" if result else "FAIL"
    print(f"[{status}] {name}")

def seed_phase_n_demo_data():
    session_id = "s_n_validator_001"; tenant_id = "t_001"; clinic_id = "c_001"; branch_id = "b_001"
    conv = log_conversation(session_id=session_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel="line", external_user_id="u_ext_val_001", user_message="botox ราคาเท่าไหร่", ai_response="มีโปร Botox ค่ะ สนใจจองได้เลย", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.0021, prompt_version="pv_001", rule_version="rv_001", response_variant_id="cta_B", inventory_snapshot_id="inv_001", message_index=1, metadata={"inventory_available":["proc_botox","proc_filler"]})
    outcome = track_outcome(session_id=session_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, booking=True, paid=True, revenue=12000, handoff_success=True, first_booking=True, booking_id="bk_val_001", invoice_id="inv_val_001", payment_id="pay_val_001", source_channel="line")
    decision = log_decision(session_id=session_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, decision_type="offer_selection", selected_option="proc_botox", options_considered=["proc_botox","proc_filler"], score=0.91, confidence=0.89, reason="pricing intent + inventory available + strong conversion pattern", model_used="gpt-4o-mini", channel="line", intent="pricing", ranked_options=["proc_botox","proc_filler"], rejected_options=["proc_filler"], policy_flags=["inventory_checked"], safety_flags=["safe"], cost_tier="cheap", prompt_version="pv_001", rule_version="rv_001", inventory_snapshot_id="inv_001")
    experiment = track_experiment(experiment_id="exp_cta_val_001", variant_id="cta_B", experiment_type="cta", session_id=session_id, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, assigned_variant="cta_B", booking=True, paid=True, revenue=12000, channel="line", intent="pricing", procedure_recommended="proc_botox", model_used="gpt-4o-mini", prompt_version="pv_001")
    return {"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"conversation":conv,"outcome":outcome,"decision":decision,"experiment":experiment}

def test_conversation_logger(seed):
    result = validate_conversation_record(seed["conversation"])
    return result.get("valid") is True

def test_outcome_tracker(seed):
    v1 = validate_outcome_record(seed["outcome"])
    pkg = build_learning_label_package(seed["session_id"])
    v2 = validate_learning_label_package(pkg)
    return v1.get("valid") is True and v2.get("valid") is True and pkg.get("exists") is True

def test_decision_logger(seed):
    v1 = validate_decision_record(seed["decision"])
    pkg = build_decision_intelligence_package(seed["session_id"])
    v2 = validate_decision_intelligence_package(pkg)
    return v1.get("valid") is True and v2.get("valid") is True and pkg.get("exists") is True

def test_experiment_tracker(seed):
    v1 = validate_experiment_record(seed["experiment"])
    summary = summarize_experiment("exp_cta_val_001")
    v2 = validate_experiment_summary(summary)
    return v1.get("valid") is True and v2.get("valid") is True and summary.get("winner_variant") is not None

def test_learning_repository(seed):
    bundle = get_session_learning_bundle(seed["session_id"])
    result = validate_learning_bundle(bundle)
    return result.get("valid") is True and bundle.get("conversation_count",0) > 0

def test_learning_analyzer(seed):
    summary = build_learning_analysis_summary(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"])
    result = validate_learning_analysis_summary(summary)
    return result.get("valid") is True

def test_prompt_improvement_engine(seed):
    pkg = build_prompt_improvement_suggestions(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"], persist=False)
    result = validate_prompt_improvement_package(pkg)
    return result.get("valid") is True

def test_recommendation_optimizer(seed):
    pkg = build_recommendation_optimization_package(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channels=["line"], persist=False)
    result = validate_recommendation_optimization_package(pkg)
    return result.get("valid") is True

def test_learning_feedback_api(seed):
    feedback = submit_learning_feedback(session_id=seed["session_id"], tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], branch_id=seed["branch_id"], reviewer_user_id="u_owner_001", feedback_type="session_review", thumbs_up=True, answer_quality="good", recommendation_quality="accurate", sales_outcome_quality="good", labels=["pricing","strong_close"])
    v1 = validate_learning_feedback_record(feedback)
    prompt_pkg = build_prompt_improvement_suggestions(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"], persist=False)
    if not prompt_pkg.get("suggestions"): return False
    approval = approve_learning_suggestion(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], reviewer_user_id="u_owner_001", suggestion_id=prompt_pkg["suggestions"][0]["suggestion_id"], suggestion_source="prompt_improvement", comment="approved for review queue")
    v2 = validate_learning_approval_record(approval)
    return v1.get("valid") is True and v2.get("valid") is True

def test_learning_policy_guard(seed):
    prompt_pkg = build_prompt_improvement_suggestions(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"], persist=False)
    reco_pkg = build_recommendation_optimization_package(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channels=["line"], persist=False)
    suggestions = []
    suggestions.extend(prompt_pkg.get("suggestions",[]))
    suggestions.extend(reco_pkg.get("suggestions",[]))
    pkg = evaluate_learning_package_policy(suggestions=suggestions, clinic_inventory=["proc_botox","proc_filler"])
    result = validate_policy_package(pkg)
    return result.get("valid") is True

def run_phase_n_validator():
    print("\n=== PHASE N VALIDATOR ===\n")
    seed = seed_phase_n_demo_data()
    results = {
        "conversation_logger": test_conversation_logger(seed),
        "outcome_tracker": test_outcome_tracker(seed),
        "decision_logger": test_decision_logger(seed),
        "experiment_tracker": test_experiment_tracker(seed),
        "learning_repository": test_learning_repository(seed),
        "learning_analyzer": test_learning_analyzer(seed),
        "prompt_improvement_engine": test_prompt_improvement_engine(seed),
        "recommendation_optimizer": test_recommendation_optimizer(seed),
        "learning_feedback_api": test_learning_feedback_api(seed),
        "learning_policy_guard": test_learning_policy_guard(seed),
    }
    for name, res in results.items(): _print_result(name, res)
    all_pass = all(results.values())
    print("\n========================")
    print("FINAL RESULT:", "PASS" if all_pass else "FAIL")
    return {"success":all_pass,"details":results}

if __name__ == "__main__":
    run_phase_n_validator()
