from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4
from learning_repository import get_clinic_learning_bundle, get_channel_learning_bundle

RECOMMENDATION_OPTIMIZATION_SUGGESTIONS: List[Dict[str, Any]] = []

DEFAULT_RECOMMENDATION_CONFIG = {
    "min_sessions_per_procedure": 2,
    "min_sessions_per_offer": 2,
    "paid_weight": 1000.0,
    "booking_weight": 100.0,
    "revenue_weight": 1.0,
    "cost_penalty_weight": 50.0,
    "inventory_required_by_default": True,
    "exclude_unsafe_procedures": True,
    "deprioritize_zero_paid_after_min_sessions": True,
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _safe_int(v):
    try: return int(v)
    except: return 0
def _safe_list(v): return v if isinstance(v, list) else []
def _safe_dict(v): return v if isinstance(v, dict) else {}
def _normalize_text(v):
    if v is None: return ""
    return str(v).strip().lower()
def _generate_optimizer_id(): return f"ros_{uuid4().hex[:16]}"
def _rate(numerator, denominator):
    if denominator <= 0: return 0.0
    return round(numerator/denominator, 4)

def _extract_inventory_map(bundle):
    inventory_map = {}
    conversations = bundle.get("conversations",[])
    for conv in conversations:
        metadata = _safe_dict(conv.get("metadata"))
        if "inventory_map" in metadata and isinstance(metadata["inventory_map"], dict):
            for key, value in metadata["inventory_map"].items(): inventory_map[key] = bool(value)
        available = metadata.get("inventory_available")
        if isinstance(available, list):
            for proc in available: inventory_map[str(proc)] = True
    return inventory_map

def _extract_safety_blocks(bundle):
    safety_blocks = {}
    decisions = bundle.get("decisions",[])
    for dec in decisions:
        selected = dec.get("selected_option")
        flags = set(_safe_list(dec.get("safety_flags")))
        if selected and ("unsafe" in flags or "blocked" in flags): safety_blocks[str(selected)] = True
    return safety_blocks

def _build_suggestion(tenant_id, clinic_id, suggestion_type, target_type, prioritized_items, deprioritized_items, reason, confidence, channel=None, metadata=None):
    return {"suggestion_id":_generate_optimizer_id(),"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":_normalize_text(channel) if channel else None,"suggestion_type":_normalize_text(suggestion_type),"target_type":_normalize_text(target_type),"prioritized_items":prioritized_items,"deprioritized_items":deprioritized_items,"reason":reason,"confidence":round(max(0.0,min(confidence,1.0)),4),"status":"draft","metadata":metadata or {},"created_at":_now_iso()}

def optimize_procedure_recommendations(tenant_id, clinic_id, config=None):
    cfg = {**DEFAULT_RECOMMENDATION_CONFIG, **(config or {})}
    bundle = get_clinic_learning_bundle(tenant_id=tenant_id, clinic_id=clinic_id)
    conversations = bundle.get("conversations",[])
    outcomes_by_session = {x.get("session_id"):x for x in bundle.get("outcomes",[])}
    inventory_map = _extract_inventory_map(bundle)
    safety_blocks = _extract_safety_blocks(bundle)
    procedure_stats = {}
    for conv in conversations:
        procedure = conv.get("procedure_recommended") or "unknown"
        session_id = conv.get("session_id")
        outcome = outcomes_by_session.get(session_id,{})
        if procedure not in procedure_stats: procedure_stats[procedure] = {"sessions":0,"booking_count":0,"paid_count":0,"total_revenue":0.0,"total_cost_estimate":0.0}
        procedure_stats[procedure]["sessions"] += 1
        procedure_stats[procedure]["booking_count"] += 1 if outcome.get("booking") else 0
        procedure_stats[procedure]["paid_count"] += 1 if outcome.get("paid") else 0
        procedure_stats[procedure]["total_revenue"] += _safe_float(outcome.get("revenue",0.0))
        procedure_stats[procedure]["total_cost_estimate"] += _safe_float(conv.get("cost_estimate",0.0))
    ranked = []; deprioritized = []
    for procedure, stats in procedure_stats.items():
        sessions = _safe_int(stats["sessions"]); booking_count = _safe_int(stats["booking_count"]); paid_count = _safe_int(stats["paid_count"]); total_revenue = _safe_float(stats["total_revenue"]); total_cost = _safe_float(stats["total_cost_estimate"])
        booking_rate = _rate(booking_count,sessions); paid_rate = _rate(paid_count,sessions); avg_revenue = round(total_revenue/sessions,2) if sessions > 0 else 0.0
        inventory_ok = inventory_map.get(procedure, True if not cfg["inventory_required_by_default"] else False)
        safety_blocked = safety_blocks.get(procedure,False)
        score = (paid_rate*cfg["paid_weight"]) + (booking_rate*cfg["booking_weight"]) + (avg_revenue*cfg["revenue_weight"]) - (total_cost*cfg["cost_penalty_weight"])
        ranked.append({"procedure":procedure,"sessions":sessions,"booking_rate":booking_rate,"paid_rate":paid_rate,"avg_revenue":avg_revenue,"total_cost_estimate":round(total_cost,6),"inventory_ok":inventory_ok,"safety_blocked":safety_blocked,"score":round(score,6)})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    prioritized_items = []
    for item in ranked:
        if item["procedure"] == "unknown": continue
        if cfg["exclude_unsafe_procedures"] and item["safety_blocked"]: deprioritized.append(item["procedure"]); continue
        if cfg["inventory_required_by_default"] and not item["inventory_ok"]: deprioritized.append(item["procedure"]); continue
        if cfg["deprioritize_zero_paid_after_min_sessions"] and item["sessions"] >= cfg["min_sessions_per_procedure"] and item["paid_rate"] == 0.0: deprioritized.append(item["procedure"]); continue
        prioritized_items.append(item["procedure"])
    suggestion = _build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="procedure_priority_optimization", target_type="procedure", prioritized_items=prioritized_items, deprioritized_items=list(dict.fromkeys(deprioritized)), reason="Prioritized by paid conversion + booking conversion + revenue - cost, constrained by inventory and safety", confidence=0.84 if prioritized_items else 0.55, metadata={"ranked_stats":ranked})
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"ranked_procedures":ranked,"suggestion":suggestion,"generated_at":_now_iso()}

def optimize_offer_strategy(tenant_id, clinic_id=None, channel=None, config=None):
    cfg = {**DEFAULT_RECOMMENDATION_CONFIG, **(config or {})}
    bundle = get_channel_learning_bundle(tenant_id=tenant_id, channel=channel or "line", clinic_id=clinic_id)
    conversations = bundle.get("conversations",[])
    outcomes_by_session = {x.get("session_id"):x for x in bundle.get("outcomes",[])}
    offer_stats = {}
    for conv in conversations:
        offer = conv.get("cta") or "none"
        session_id = conv.get("session_id")
        outcome = outcomes_by_session.get(session_id,{})
        if offer not in offer_stats: offer_stats[offer] = {"sessions":0,"booking_count":0,"paid_count":0,"total_revenue":0.0}
        offer_stats[offer]["sessions"] += 1
        offer_stats[offer]["booking_count"] += 1 if outcome.get("booking") else 0
        offer_stats[offer]["paid_count"] += 1 if outcome.get("paid") else 0
        offer_stats[offer]["total_revenue"] += _safe_float(outcome.get("revenue",0.0))
    ranked = []; deprioritized = []
    for offer, stats in offer_stats.items():
        sessions = _safe_int(stats["sessions"]); booking_rate = _rate(stats["booking_count"],sessions); paid_rate = _rate(stats["paid_count"],sessions); avg_revenue = round(_safe_float(stats["total_revenue"])/sessions,2) if sessions > 0 else 0.0
        score = (paid_rate*cfg["paid_weight"]) + (booking_rate*cfg["booking_weight"]) + (avg_revenue*cfg["revenue_weight"])
        ranked.append({"offer":offer,"sessions":sessions,"booking_rate":booking_rate,"paid_rate":paid_rate,"avg_revenue":avg_revenue,"score":round(score,6)})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    prioritized_items = []
    for item in ranked:
        if item["offer"] == "none": continue
        if cfg["deprioritize_zero_paid_after_min_sessions"] and item["sessions"] >= cfg["min_sessions_per_offer"] and item["paid_rate"] == 0.0: deprioritized.append(item["offer"]); continue
        prioritized_items.append(item["offer"])
    suggestion = _build_suggestion(tenant_id=tenant_id, clinic_id=clinic_id, suggestion_type="offer_strategy_optimization", target_type="cta_or_offer", prioritized_items=prioritized_items, deprioritized_items=list(dict.fromkeys(deprioritized)), reason="Prioritized by channel-specific paid conversion, booking rate, and revenue", confidence=0.8 if prioritized_items else 0.55, channel=channel, metadata={"ranked_stats":ranked})
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":channel,"ranked_offers":ranked,"suggestion":suggestion,"generated_at":_now_iso()}

def build_recommendation_optimization_package(tenant_id, clinic_id, channels=None, config=None, persist=False):
    channels = channels or ["line"]
    procedure_package = optimize_procedure_recommendations(tenant_id=tenant_id, clinic_id=clinic_id, config=config)
    offer_packages = [optimize_offer_strategy(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel, config=config) for channel in channels]
    suggestions = [procedure_package["suggestion"]] + [x["suggestion"] for x in offer_packages]
    if persist: RECOMMENDATION_OPTIMIZATION_SUGGESTIONS.extend(suggestions)
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"procedure_package":procedure_package,"offer_packages":offer_packages,"suggestions":suggestions,"generated_at":_now_iso()}

def list_recommendation_optimization_suggestions(tenant_id=None, clinic_id=None, suggestion_type=None, status=None, limit=100):
    results = []
    for item in reversed(RECOMMENDATION_OPTIMIZATION_SUGGESTIONS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if suggestion_type and item.get("suggestion_type") != _normalize_text(suggestion_type): continue
        if status and item.get("status") != _normalize_text(status): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def validate_recommendation_suggestion(item):
    errors = []
    for field in ["suggestion_id","tenant_id","suggestion_type","target_type","prioritized_items","deprioritized_items","reason","confidence","status","created_at"]:
        if field not in item: errors.append(f"missing {field}")
    if not isinstance(item.get("prioritized_items",[]), list): errors.append("prioritized_items must be a list")
    if not isinstance(item.get("deprioritized_items",[]), list): errors.append("deprioritized_items must be a list")
    confidence = _safe_float(item.get("confidence",0.0))
    if confidence < 0 or confidence > 1: errors.append("confidence must be between 0 and 1")
    return {"valid": len(errors)==0, "errors": errors}

def validate_recommendation_optimization_package(package):
    errors = []
    for field in ["procedure_package","offer_packages","suggestions","generated_at"]:
        if field not in package: errors.append(f"missing {field}")
    if not isinstance(package.get("offer_packages",[]), list): errors.append("offer_packages must be a list")
    if not isinstance(package.get("suggestions",[]), list): errors.append("suggestions must be a list")
    for idx, item in enumerate(package.get("suggestions",[])):
        result = validate_recommendation_suggestion(item)
        if not result["valid"]:
            for err in result["errors"]: errors.append(f"suggestions[{idx}]: {err}")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversation_logger import log_conversation
    from outcome_tracker import track_outcome
    print("=== RECOMMENDATION OPTIMIZER TEST ===")
    log_conversation(session_id="s_301", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_301", user_message="อยากลดริ้วรอย", ai_response="Botox เหมาะค่ะ", intent="recommendation", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.002, prompt_version="pv_001", metadata={"inventory_available":["proc_botox","proc_filler"]})
    track_outcome(session_id="s_301", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, source_channel="line")
    full_pkg = build_recommendation_optimization_package(tenant_id="t_001", clinic_id="c_001", channels=["line"], persist=True)
    print("FULL PKG suggestions:", len(full_pkg["suggestions"]))
    print("FULL VALID:", validate_recommendation_optimization_package(full_pkg))
