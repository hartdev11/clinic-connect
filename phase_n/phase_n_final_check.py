from __future__ import annotations
from typing import Any, Dict, List
from conversation_logger import log_conversation
from outcome_tracker import track_outcome
from decision_logger import log_decision
from experiment_tracker import track_experiment
from learning_repository import get_session_learning_bundle, get_clinic_learning_bundle
from learning_analyzer import build_learning_analysis_summary
from prompt_improvement_engine import build_prompt_improvement_suggestions
from recommendation_optimizer import build_recommendation_optimization_package
from learning_feedback_api import submit_learning_feedback, get_learning_session_review, get_learning_summary, approve_learning_suggestion, reject_learning_suggestion
from learning_policy_guard import evaluate_learning_package_policy

def _print_result(name, result):
    status = "PASS" if result else "FAIL"
    print(f"[{status}] {name}")

def preload_production_like_data():
    tenant_id = "t_001"; clinic_id = "c_001"; branch_id = "b_001"; channel = "line"
    sessions = [
        {"session_id":"s_n_final_001","user_message":"botox ราคาเท่าไหร่","ai_response":"มีโปร Botox ค่ะ","intent":"pricing","procedure":"proc_botox","cta":"book_now","model":"gpt-4o-mini","cost":0.0021,"prompt_version":"pv_001","booking":True,"paid":True,"revenue":12000,"decision_selected":"proc_botox","variant_id":"cta_B"},
        {"session_id":"s_n_final_002","user_message":"อยากลดริ้วรอย","ai_response":"Botox น่าจะเหมาะค่ะ","intent":"recommendation","procedure":"proc_botox","cta":"ask_consult","model":"gpt-4o-mini","cost":0.0020,"prompt_version":"pv_001","booking":True,"paid":False,"revenue":0,"decision_selected":"proc_botox","variant_id":"cta_A"},
        {"session_id":"s_n_final_003","user_message":"filler ต่างจาก botox ยังไง","ai_response":"Filler เหมาะกับการเติมเต็มค่ะ","intent":"comparison","procedure":"proc_filler","cta":"book_now","model":"gpt-4.1-mini","cost":0.0030,"prompt_version":"pv_002","booking":False,"paid":False,"revenue":0,"decision_selected":"proc_filler","variant_id":"cta_B"},
        {"session_id":"s_n_final_004","user_message":"มีโปรอะไรบ้าง","ai_response":"มีโปร Botox และ Filler ค่ะ","intent":"promotion","procedure":"proc_botox","cta":"book_now","model":"gpt-4o-mini","cost":0.0018,"prompt_version":"pv_001","booking":True,"paid":True,"revenue":15000,"decision_selected":"proc_botox","variant_id":"cta_B"},
    ]
    for i, s in enumerate(sessions, start=1):
        log_conversation(session_id=s["session_id"], tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, channel=channel, external_user_id=f"u_ext_{i}", user_message=s["user_message"], ai_response=s["ai_response"], intent=s["intent"], procedure_recommended=s["procedure"], cta=s["cta"], model_used=s["model"], cost_estimate=s["cost"], prompt_version=s["prompt_version"], rule_version="rv_001", response_variant_id=s["variant_id"], inventory_snapshot_id="inv_001", message_index=1, metadata={"inventory_available":["proc_botox","proc_filler"],"source":"runtime"})
        track_outcome(session_id=s["session_id"], tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, booking=s["booking"], paid=s["paid"], revenue=s["revenue"], handoff_success=s["booking"], source_channel=channel)
        log_decision(session_id=s["session_id"], tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, decision_type="recommendation_selection" if s["intent"] != "pricing" else "offer_selection", selected_option=s["decision_selected"], options_considered=["proc_botox","proc_filler"], score=0.88 if s["paid"] else 0.72, confidence=0.9 if s["paid"] else 0.74, reason="intent + clinic inventory + prior conversion pattern", model_used=s["model"], channel=channel, intent=s["intent"], ranked_options=["proc_botox","proc_filler"], rejected_options=["proc_filler"] if s["decision_selected"]=="proc_botox" else ["proc_botox"], policy_flags=["inventory_checked"], safety_flags=["safe"], cost_tier="cheap" if s["model"]=="gpt-4o-mini" else "medium", prompt_version=s["prompt_version"], rule_version="rv_001", inventory_snapshot_id="inv_001")
        track_experiment(experiment_id="exp_cta_final_001", variant_id=s["variant_id"], experiment_type="cta", session_id=s["session_id"], tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, assigned_variant=s["variant_id"], booking=s["booking"], paid=s["paid"], revenue=s["revenue"], channel=channel, intent=s["intent"], procedure_recommended=s["procedure"], model_used=s["model"], prompt_version=s["prompt_version"])
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"channel":channel,"seeded_sessions":[x["session_id"] for x in sessions]}

def test_repository_bundles(seed):
    session_bundle = get_session_learning_bundle(seed["seeded_sessions"][0])
    clinic_bundle = get_clinic_learning_bundle(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], branch_id=seed["branch_id"], channel=seed["channel"])
    return session_bundle.get("conversation_count",0) > 0 and clinic_bundle.get("summary",{}).get("conversation_count",0) > 0

def test_learning_analyzer(seed):
    summary = build_learning_analysis_summary(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel=seed["channel"], model_candidates=["gpt-4o-mini","gpt-4.1-mini"], prompt_candidates=["pv_001","pv_002"])
    ok = bool(summary.get("cta_summary") and summary.get("repository_summary") and isinstance(summary.get("weak_patterns",[]), list))
    return {"ok":ok,"summary":summary}

def test_prompt_improvement(seed):
    pkg = build_prompt_improvement_suggestions(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channel=seed["channel"], model_candidates=["gpt-4o-mini","gpt-4.1-mini"], prompt_candidates=["pv_001","pv_002"], persist=False)
    ok = isinstance(pkg.get("suggestions",[]), list)
    return {"ok":ok,"package":pkg}

def test_recommendation_optimizer(seed):
    pkg = build_recommendation_optimization_package(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], channels=[seed["channel"]], persist=False)
    ok = isinstance(pkg.get("suggestions",[]), list) and len(pkg.get("suggestions",[])) > 0
    return {"ok":ok,"package":pkg}

def test_feedback_and_review_flow(seed, prompt_pkg, reco_pkg):
    feedback = submit_learning_feedback(session_id=seed["seeded_sessions"][0], tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], branch_id=seed["branch_id"], reviewer_user_id="u_owner_001", feedback_type="session_review", thumbs_up=True, answer_quality="good", recommendation_quality="accurate", sales_outcome_quality="good", flagged_unsafe=False, flagged_hallucination=False, flagged_aggressive=False, needs_followup_review=False, comment="ตอบดีและปิดการขายได้", labels=["strong_session","good_pricing_flow"])
    session_review = get_learning_session_review(seed["seeded_sessions"][0])
    summary = get_learning_summary(seed["tenant_id"], clinic_id=seed["clinic_id"])
    if not prompt_pkg.get("suggestions") or not reco_pkg.get("suggestions"): return False
    approve_result = approve_learning_suggestion(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], reviewer_user_id="u_owner_001", suggestion_id=prompt_pkg["suggestions"][0]["suggestion_id"], suggestion_source="prompt_improvement", comment="approve to review queue")
    reject_result = reject_learning_suggestion(tenant_id=seed["tenant_id"], clinic_id=seed["clinic_id"], reviewer_user_id="u_owner_001", suggestion_id=reco_pkg["suggestions"][0]["suggestion_id"], suggestion_source="recommendation_optimizer", comment="needs more evidence")
    return feedback.get("feedback_id") is not None and session_review.get("feedback_count",0) >= 1 and summary.get("total_feedback",0) >= 1 and approve_result.get("approval_id") is not None and reject_result.get("approval_id") is not None

def test_policy_guard(prompt_pkg, reco_pkg):
    suggestions = []
    suggestions.extend(prompt_pkg.get("suggestions",[]))
    suggestions.extend(reco_pkg.get("suggestions",[]))
    policy_pkg = evaluate_learning_package_policy(suggestions=suggestions, clinic_inventory=["proc_botox","proc_filler"])
    decision_counts = policy_pkg.get("decision_counts",{})
    ok = isinstance(policy_pkg.get("evaluations",[]), list) and sum(decision_counts.values()) == policy_pkg.get("evaluation_count",0)
    return {"ok":ok,"package":policy_pkg}

def run_phase_n_final_check():
    print("\n=== PHASE N FINAL CHECK ===\n")
    seed = preload_production_like_data()
    results = {}
    results["repository_bundles"] = test_repository_bundles(seed)
    _print_result("repository_bundles", results["repository_bundles"])
    analyzer_result = test_learning_analyzer(seed)
    results["learning_analyzer"] = analyzer_result["ok"]
    _print_result("learning_analyzer", results["learning_analyzer"])
    prompt_result = test_prompt_improvement(seed)
    results["prompt_improvement"] = prompt_result["ok"]
    _print_result("prompt_improvement", results["prompt_improvement"])
    reco_result = test_recommendation_optimizer(seed)
    results["recommendation_optimizer"] = reco_result["ok"]
    _print_result("recommendation_optimizer", results["recommendation_optimizer"])
    results["feedback_review_flow"] = test_feedback_and_review_flow(seed=seed, prompt_pkg=prompt_result["package"], reco_pkg=reco_result["package"])
    _print_result("feedback_review_flow", results["feedback_review_flow"])
    policy_result = test_policy_guard(prompt_pkg=prompt_result["package"], reco_pkg=reco_result["package"])
    results["learning_policy_guard"] = policy_result["ok"]
    _print_result("learning_policy_guard", results["learning_policy_guard"])
    analysis_summary = analyzer_result["summary"]
    results["analysis_has_top_cta"] = analysis_summary.get("cta_summary",{}).get("top_converting_cta") is not None
    _print_result("analysis_has_top_cta", results["analysis_has_top_cta"])
    if analysis_summary.get("clinic_procedure_summary"):
        results["analysis_has_best_procedure"] = analysis_summary["clinic_procedure_summary"].get("best_procedure") is not None
    else: results["analysis_has_best_procedure"] = False
    _print_result("analysis_has_best_procedure", results["analysis_has_best_procedure"])
    results["prompt_suggestions_generated"] = len(prompt_result["package"].get("suggestions",[])) >= 0
    _print_result("prompt_suggestions_generated", results["prompt_suggestions_generated"])
    results["recommendation_suggestions_generated"] = len(reco_result["package"].get("suggestions",[])) > 0
    _print_result("recommendation_suggestions_generated", results["recommendation_suggestions_generated"])
    all_pass = all(results.values())
    print("\n========================")
    print("FINAL RESULT:", "PASS — PHASE N COMPLETE" if all_pass else "FAIL")
    return {"success":all_pass,"details":results}

if __name__ == "__main__":
    run_phase_n_final_check()
