from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from learning_repository import get_clinic_learning_bundle, get_channel_learning_bundle, get_model_performance_bundle, get_prompt_variant_bundle, build_learning_repository_summary

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _safe_int(v):
    try: return int(v)
    except: return 0
def _top_key_by_value(counter):
    if not counter: return None
    return max(counter.items(), key=lambda x: x[1])[0]
def _rate(numerator, denominator):
    if denominator <= 0: return 0.0
    return round(numerator/denominator, 4)

def analyze_cta_performance(tenant_id, clinic_id=None):
    bundle = get_clinic_learning_bundle(tenant_id=tenant_id, clinic_id=clinic_id or "")
    conversations = bundle.get("conversations",[])
    outcomes_by_session = {x.get("session_id"):x for x in bundle.get("outcomes",[])}
    cta_stats = {}
    for conv in conversations:
        cta = conv.get("cta") or "none"
        session_id = conv.get("session_id")
        outcome = outcomes_by_session.get(session_id,{})
        if cta not in cta_stats: cta_stats[cta] = {"sessions":0,"booking_count":0,"paid_count":0,"total_revenue":0.0}
        cta_stats[cta]["sessions"] += 1
        cta_stats[cta]["booking_count"] += 1 if outcome.get("booking") else 0
        cta_stats[cta]["paid_count"] += 1 if outcome.get("paid") else 0
        cta_stats[cta]["total_revenue"] += _safe_float(outcome.get("revenue",0.0))
    winner_cta = None; winner_score = -1.0
    for cta, stats in cta_stats.items():
        sessions = stats["sessions"]
        booking_rate = _rate(stats["booking_count"], sessions)
        paid_rate = _rate(stats["paid_count"], sessions)
        avg_revenue = round(stats["total_revenue"]/sessions,2) if sessions > 0 else 0.0
        stats["booking_rate"] = booking_rate; stats["paid_rate"] = paid_rate; stats["avg_revenue"] = avg_revenue; stats["total_revenue"] = round(stats["total_revenue"],2)
        score = (paid_rate*1000) + (booking_rate*100) + avg_revenue
        if score > winner_score: winner_score = score; winner_cta = cta
    weak_ctas = [cta for cta, stats in cta_stats.items() if stats.get("sessions",0) >= 3 and stats.get("booking_rate",0.0) < 0.1]
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"cta_stats":cta_stats,"top_converting_cta":winner_cta,"weak_ctas":weak_ctas,"generated_at":_now_iso()}

def analyze_procedure_performance_by_clinic(tenant_id, clinic_id):
    bundle = get_clinic_learning_bundle(tenant_id=tenant_id, clinic_id=clinic_id)
    conversations = bundle.get("conversations",[])
    outcomes_by_session = {x.get("session_id"):x for x in bundle.get("outcomes",[])}
    procedure_stats = {}
    for conv in conversations:
        procedure = conv.get("procedure_recommended") or "unknown"
        session_id = conv.get("session_id")
        outcome = outcomes_by_session.get(session_id,{})
        if procedure not in procedure_stats: procedure_stats[procedure] = {"sessions":0,"booking_count":0,"paid_count":0,"total_revenue":0.0}
        procedure_stats[procedure]["sessions"] += 1
        procedure_stats[procedure]["booking_count"] += 1 if outcome.get("booking") else 0
        procedure_stats[procedure]["paid_count"] += 1 if outcome.get("paid") else 0
        procedure_stats[procedure]["total_revenue"] += _safe_float(outcome.get("revenue",0.0))
    best_procedure = None; best_score = -1.0
    for procedure, stats in procedure_stats.items():
        sessions = stats["sessions"]
        booking_rate = _rate(stats["booking_count"],sessions)
        paid_rate = _rate(stats["paid_count"],sessions)
        avg_revenue = round(stats["total_revenue"]/sessions,2) if sessions > 0 else 0.0
        stats["booking_rate"] = booking_rate; stats["paid_rate"] = paid_rate; stats["avg_revenue"] = avg_revenue; stats["total_revenue"] = round(stats["total_revenue"],2)
        score = (paid_rate*1000) + (booking_rate*100) + avg_revenue
        if score > best_score: best_score = score; best_procedure = procedure
    poor_procedures = [p for p, stats in procedure_stats.items() if stats.get("sessions",0) >= 3 and stats.get("paid_rate",0.0) == 0.0]
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"procedure_stats":procedure_stats,"best_procedure":best_procedure,"poor_procedures":poor_procedures,"generated_at":_now_iso()}

def analyze_channel_performance(tenant_id, channel, clinic_id=None):
    bundle = get_channel_learning_bundle(tenant_id=tenant_id, channel=channel, clinic_id=clinic_id)
    outcomes = bundle.get("outcomes",[])
    conversations = bundle.get("conversations",[])
    total_sessions = len({x.get("session_id") for x in conversations if x.get("session_id")})
    total_bookings = sum(1 for x in outcomes if x.get("booking"))
    total_paid = sum(1 for x in outcomes if x.get("paid"))
    total_revenue = round(sum(_safe_float(x.get("revenue",0.0)) for x in outcomes),2)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":channel,"total_sessions":total_sessions,"total_bookings":total_bookings,"total_paid":total_paid,"booking_rate":_rate(total_bookings,total_sessions),"paid_rate":_rate(total_paid,total_sessions),"total_revenue":total_revenue,"generated_at":_now_iso()}

def analyze_model_cost_efficiency(tenant_id, model_used, clinic_id=None):
    bundle = get_model_performance_bundle(tenant_id=tenant_id, model_used=model_used, clinic_id=clinic_id)
    conversations = bundle.get("conversations",[])
    outcomes = bundle.get("outcomes",[])
    total_sessions = len({x.get("session_id") for x in conversations if x.get("session_id")})
    total_paid = sum(1 for x in outcomes if x.get("paid"))
    total_revenue = round(sum(_safe_float(x.get("revenue",0.0)) for x in outcomes),2)
    total_cost = round(sum(_safe_float(x.get("cost_estimate",0.0)) for x in conversations),6)
    cost_per_paid = round(total_cost/total_paid,6) if total_paid > 0 else None
    revenue_per_cost = round(total_revenue/total_cost,4) if total_cost > 0 else None
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"model_used":model_used,"total_sessions":total_sessions,"total_paid":total_paid,"total_revenue":total_revenue,"total_cost_estimate":total_cost,"paid_rate":_rate(total_paid,total_sessions),"cost_per_paid":cost_per_paid,"revenue_per_cost":revenue_per_cost,"generated_at":_now_iso()}

def analyze_prompt_variant_performance(tenant_id, prompt_version, clinic_id=None):
    bundle = get_prompt_variant_bundle(tenant_id=tenant_id, prompt_version=prompt_version, clinic_id=clinic_id)
    outcomes = bundle.get("outcomes",[])
    conversations = bundle.get("conversations",[])
    decisions = bundle.get("decisions",[])
    total_sessions = len({x.get("session_id") for x in conversations if x.get("session_id")})
    total_booking = sum(1 for x in outcomes if x.get("booking"))
    total_paid = sum(1 for x in outcomes if x.get("paid"))
    total_revenue = round(sum(_safe_float(x.get("revenue",0.0)) for x in outcomes),2)
    weak_signals = []
    if total_sessions >= 3 and _rate(total_booking,total_sessions) < 0.1: weak_signals.append("low_booking_rate")
    if total_sessions >= 3 and _rate(total_paid,total_sessions) == 0.0: weak_signals.append("no_paid_conversion")
    intent_counter = {}
    for conv in conversations:
        intent = conv.get("intent") or "unknown"
        intent_counter[intent] = intent_counter.get(intent,0) + 1
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"prompt_version":prompt_version,"total_sessions":total_sessions,"booking_rate":_rate(total_booking,total_sessions),"paid_rate":_rate(total_paid,total_sessions),"total_revenue":total_revenue,"dominant_intent":_top_key_by_value(intent_counter),"weak_signals":weak_signals,"decision_count":len(decisions),"generated_at":_now_iso()}

def build_learning_analysis_summary(tenant_id, clinic_id=None, channel=None, model_candidates=None, prompt_candidates=None):
    repository_summary = build_learning_repository_summary(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel)
    cta_summary = analyze_cta_performance(tenant_id=tenant_id, clinic_id=clinic_id)
    clinic_procedure_summary = None
    if clinic_id: clinic_procedure_summary = analyze_procedure_performance_by_clinic(tenant_id=tenant_id, clinic_id=clinic_id)
    channel_summary = None
    if channel: channel_summary = analyze_channel_performance(tenant_id=tenant_id, channel=channel, clinic_id=clinic_id)
    model_summaries = [analyze_model_cost_efficiency(tenant_id=tenant_id, model_used=m, clinic_id=clinic_id) for m in (model_candidates or [])]
    prompt_summaries = [analyze_prompt_variant_performance(tenant_id=tenant_id, prompt_version=p, clinic_id=clinic_id) for p in (prompt_candidates or [])]
    weak_patterns = []
    if cta_summary.get("weak_ctas"): weak_patterns.append({"type":"weak_cta","items":cta_summary["weak_ctas"]})
    if clinic_procedure_summary and clinic_procedure_summary.get("poor_procedures"): weak_patterns.append({"type":"poor_procedure","items":clinic_procedure_summary["poor_procedures"]})
    for p in prompt_summaries:
        if p.get("weak_signals"): weak_patterns.append({"type":"weak_prompt","prompt_version":p.get("prompt_version"),"items":p.get("weak_signals")})
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":channel,"repository_summary":repository_summary,"cta_summary":cta_summary,"clinic_procedure_summary":clinic_procedure_summary,"channel_summary":channel_summary,"model_summaries":model_summaries,"prompt_summaries":prompt_summaries,"weak_patterns":weak_patterns,"generated_at":_now_iso()}

def validate_learning_analysis_summary(summary):
    errors = []
    for field in ["repository_summary","cta_summary","model_summaries","prompt_summaries","weak_patterns","generated_at"]:
        if field not in summary: errors.append(f"missing {field}")
    if not isinstance(summary.get("model_summaries",[]), list): errors.append("model_summaries must be a list")
    if not isinstance(summary.get("prompt_summaries",[]), list): errors.append("prompt_summaries must be a list")
    if not isinstance(summary.get("weak_patterns",[]), list): errors.append("weak_patterns must be a list")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversation_logger import log_conversation
    from outcome_tracker import track_outcome
    from decision_logger import log_decision
    from experiment_tracker import track_experiment
    print("=== LEARNING ANALYZER TEST ===")
    log_conversation(session_id="s_101", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_101", user_message="Botox ราคาเท่าไหร่", ai_response="มีโปรค่ะ จองได้เลย", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.002, prompt_version="pv_001")
    track_outcome(session_id="s_101", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, source_channel="line")
    summary = build_learning_analysis_summary(tenant_id="t_001", clinic_id="c_001", channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"])
    print("SUMMARY:", summary)
    print("VALID:", validate_learning_analysis_summary(summary))
