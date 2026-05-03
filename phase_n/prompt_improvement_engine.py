from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4
from learning_analyzer import build_learning_analysis_summary

PROMPT_IMPROVEMENT_SUGGESTIONS: List[Dict[str, Any]] = []

DEFAULT_PROMPT_IMPROVEMENT_CONFIG = {
    "low_booking_rate_threshold": 0.10,
    "low_paid_rate_threshold": 0.05,
    "short_message_channels": ["line","instagram"],
    "high_performing_cta_min_paid_rate": 0.10,
    "high_performing_cta_min_booking_rate": 0.20,
    "enable_channel_style_suggestions": True,
    "enable_cta_suggestions": True,
    "enable_prompt_version_suggestions": True,
    "enable_trust_proof_suggestions": True,
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _safe_list(v): return v if isinstance(v, list) else []
def _normalize_text(v):
    if v is None: return ""
    return str(v).strip().lower()
def _generate_suggestion_id(): return f"psi_{uuid4().hex[:16]}"

def _build_suggestion(tenant_id, clinic_id, suggestion_type, target, change_type, reason, confidence, channel=None, prompt_version=None, intent=None, metadata=None):
    return {"suggestion_id":_generate_suggestion_id(),"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":_normalize_text(channel) if channel else None,"prompt_version":prompt_version,"intent":_normalize_text(intent) if intent else None,"suggestion_type":_normalize_text(suggestion_type),"target":target,"change_type":_normalize_text(change_type),"reason":reason,"confidence":round(max(0.0,min(confidence,1.0)),4),"status":"draft","metadata":metadata or {},"created_at":_now_iso()}

def generate_cta_improvement_suggestions(analysis_summary, config=None):
    config = {**DEFAULT_PROMPT_IMPROVEMENT_CONFIG, **(config or {})}
    tenant_id = analysis_summary.get("tenant_id"); clinic_id = analysis_summary.get("clinic_id"); channel = analysis_summary.get("channel")
    cta_summary = analysis_summary.get("cta_summary",{}) or {}
    cta_stats = cta_summary.get("cta_stats",{}) or {}
    top_cta = cta_summary.get("top_converting_cta")
    weak_ctas = _safe_list(cta_summary.get("weak_ctas"))
    suggestions = []
    if config.get("enable_cta_suggestions",True):
        if top_cta and top_cta in cta_stats:
            top_stats = cta_stats[top_cta]
            paid_rate = _safe_float(top_stats.get("paid_rate")); booking_rate = _safe_float(top_stats.get("booking_rate"))
            if paid_rate >= config["high_performing_cta_min_paid_rate"] or booking_rate >= config["high_performing_cta_min_booking_rate"]:
                suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="cta_improvement", target="cta_prompt_rules", change_type="prioritize_top_cta", reason=f"CTA '{top_cta}' has strongest conversion pattern in current data", confidence=0.82, channel=channel, metadata={"top_cta":top_cta,"cta_stats":top_stats}))
        for weak_cta in weak_ctas:
            suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="cta_improvement", target="cta_prompt_rules", change_type="deprioritize_weak_cta", reason=f"CTA '{weak_cta}' shows weak booking conversion and should be reduced or rewritten", confidence=0.74, channel=channel, metadata={"weak_cta":weak_cta}))
    return suggestions

def generate_channel_style_suggestions(analysis_summary, config=None):
    config = {**DEFAULT_PROMPT_IMPROVEMENT_CONFIG, **(config or {})}
    if not config.get("enable_channel_style_suggestions",True): return []
    tenant_id = analysis_summary.get("tenant_id"); clinic_id = analysis_summary.get("clinic_id"); channel = analysis_summary.get("channel")
    weak_patterns = _safe_list(analysis_summary.get("weak_patterns"))
    suggestions = []
    if channel in config.get("short_message_channels",[]):
        suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="channel_style_improvement", target="channel_response_style", change_type="shorten_responses", reason=f"Channel '{channel}' should prefer shorter and more direct responses", confidence=0.78, channel=channel, metadata={"channel":channel}))
    if weak_patterns:
        suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="channel_style_improvement", target="channel_response_style", change_type="reduce_drop_risk", reason="Weak patterns detected; adjust tone/length/clarity to reduce drop-off", confidence=0.69, channel=channel, metadata={"weak_patterns":weak_patterns}))
    return suggestions

def generate_prompt_version_suggestions(analysis_summary, config=None):
    config = {**DEFAULT_PROMPT_IMPROVEMENT_CONFIG, **(config or {})}
    if not config.get("enable_prompt_version_suggestions",True): return []
    tenant_id = analysis_summary.get("tenant_id"); clinic_id = analysis_summary.get("clinic_id"); channel = analysis_summary.get("channel")
    prompt_summaries = _safe_list(analysis_summary.get("prompt_summaries"))
    suggestions = []
    for item in prompt_summaries:
        prompt_version = item.get("prompt_version"); weak_signals = _safe_list(item.get("weak_signals")); dominant_intent = item.get("dominant_intent")
        if "low_booking_rate" in weak_signals:
            suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="prompt_version_improvement", target=prompt_version or "unknown_prompt", change_type="increase_clarity_and_cta_strength", reason="Prompt version has low booking rate and may need stronger clarity/CTA structure", confidence=0.76, channel=channel, prompt_version=prompt_version, intent=dominant_intent, metadata={"weak_signals":weak_signals}))
        if "no_paid_conversion" in weak_signals:
            suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="prompt_version_improvement", target=prompt_version or "unknown_prompt", change_type="improve_trust_and_conversion_flow", reason="Prompt version has no paid conversion and likely needs stronger trust proof or offer sequencing", confidence=0.81, channel=channel, prompt_version=prompt_version, intent=dominant_intent, metadata={"weak_signals":weak_signals}))
    return suggestions

def generate_trust_proof_suggestions(analysis_summary, config=None):
    config = {**DEFAULT_PROMPT_IMPROVEMENT_CONFIG, **(config or {})}
    if not config.get("enable_trust_proof_suggestions",True): return []
    tenant_id = analysis_summary.get("tenant_id"); clinic_id = analysis_summary.get("clinic_id")
    clinic_procedure_summary = analysis_summary.get("clinic_procedure_summary") or {}
    poor_procedures = _safe_list(clinic_procedure_summary.get("poor_procedures"))
    suggestions = []
    if poor_procedures:
        suggestions.append(_build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="trust_proof_improvement", target="procedure_sales_prompt", change_type="add_credibility_and_expectation_setting", reason="Some procedures underperform and may require more credibility, expectation setting, or qualification before CTA", confidence=0.72, metadata={"poor_procedures":poor_procedures}))
    return suggestions

def build_prompt_improvement_suggestions(tenant_id, clinic_id=None, channel=None, model_candidates=None, prompt_candidates=None, config=None, persist=False):
    analysis_summary = build_learning_analysis_summary(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel, model_candidates=model_candidates or [], prompt_candidates=prompt_candidates or [])
    suggestions = []
    suggestions.extend(generate_cta_improvement_suggestions(analysis_summary, config=config))
    suggestions.extend(generate_channel_style_suggestions(analysis_summary, config=config))
    suggestions.extend(generate_prompt_version_suggestions(analysis_summary, config=config))
    suggestions.extend(generate_trust_proof_suggestions(analysis_summary, config=config))
    if persist: PROMPT_IMPROVEMENT_SUGGESTIONS.extend(suggestions)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":channel,"suggestion_count":len(suggestions),"suggestions":suggestions,"analysis_summary":analysis_summary,"generated_at":_now_iso()}

def list_prompt_improvement_suggestions(tenant_id=None, clinic_id=None, suggestion_type=None, status=None, limit=100):
    results = []
    for item in reversed(PROMPT_IMPROVEMENT_SUGGESTIONS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if suggestion_type and item.get("suggestion_type") != _normalize_text(suggestion_type): continue
        if status and item.get("status") != _normalize_text(status): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def validate_prompt_improvement_suggestion(item):
    errors = []
    for field in ["suggestion_id","tenant_id","suggestion_type","target","change_type","reason","confidence","status","created_at"]:
        if field not in item: errors.append(f"missing {field}")
    confidence = _safe_float(item.get("confidence",0.0))
    if confidence < 0 or confidence > 1: errors.append("confidence must be between 0 and 1")
    return {"valid": len(errors)==0, "errors": errors}

def validate_prompt_improvement_package(package):
    errors = []
    for field in ["suggestion_count","suggestions","analysis_summary","generated_at"]:
        if field not in package: errors.append(f"missing {field}")
    if not isinstance(package.get("suggestions",[]), list): errors.append("suggestions must be a list")
    if not isinstance(package.get("analysis_summary",{}), dict): errors.append("analysis_summary must be a dict")
    for idx, item in enumerate(package.get("suggestions",[])):
        result = validate_prompt_improvement_suggestion(item)
        if not result["valid"]:
            for err in result["errors"]: errors.append(f"suggestions[{idx}]: {err}")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversation_logger import log_conversation
    from outcome_tracker import track_outcome
    print("=== PROMPT IMPROVEMENT ENGINE TEST ===")
    log_conversation(session_id="s_201", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_201", user_message="botox ราคาเท่าไหร่", ai_response="มีหลายโปรค่ะ", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.0021, prompt_version="pv_001")
    track_outcome(session_id="s_201", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=False, revenue=0, source_channel="line")
    package = build_prompt_improvement_suggestions(tenant_id="t_001", clinic_id="c_001", channel="line", model_candidates=["gpt-4o-mini"], prompt_candidates=["pv_001"], persist=True)
    print("PACKAGE suggestion_count:", package["suggestion_count"])
    print("VALID:", validate_prompt_improvement_package(package))
