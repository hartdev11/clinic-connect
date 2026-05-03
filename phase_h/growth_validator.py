from __future__ import annotations
from typing import Any, Dict, List, Optional
from usage_trigger_engine import validate_trigger_bundle
from topup_recommendation_engine import validate_topup_recommendation
from promotion_automation_engine import validate_automated_promotion_bundle
from conversion_tracker import validate_funnel_summary
from funnel_analyzer import validate_funnel_analysis

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _safe_int(v):
    try: return int(v)
    except: return 0

def _append_prefixed_errors(target, prefix, validation_result):
    for err in validation_result.get("errors", []): target.append(f"{prefix}: {err}")

def validate_growth_snapshot(snapshot):
    errors = []
    for field in ["tenant_id","growth_triggers","topup_recommendation","automated_promotions","funnel_summary","funnel_analysis"]:
        if field not in snapshot: errors.append(f"missing field: {field}")
    for field in ["growth_triggers","topup_recommendation","automated_promotions","funnel_summary","funnel_analysis"]:
        if not isinstance(snapshot.get(field), dict): errors.append(f"{field} must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

def validate_priority_action(action):
    errors = []
    for field in ["action_type","priority"]:
        if field not in action: errors.append(f"missing field: {field}")
    if action.get("action_type") not in {"force_topup","show_topup_offer","show_promotion","no_action"}: errors.append("invalid action_type")
    if action.get("priority") not in {"low","medium","high","critical"}: errors.append("invalid priority")
    return {"valid": len(errors)==0, "errors": errors}

def validate_trigger_recommendation_consistency(trigger_bundle, recommendation):
    errors = []
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    highest_level = highest.get("level")
    recommended_pack = recommendation.get("recommended_pack")
    should_recommend = recommendation.get("should_recommend")
    if highest_level in {"high","critical"} and should_recommend is not True:
        errors.append("high/critical trigger should generally produce recommendation")
    if should_recommend and recommended_pack is None:
        errors.append("should_recommend is true but recommended_pack is missing")
    if recommended_pack is not None:
        for field in ["pack_id","name","total_tokens","price"]:
            if field not in recommended_pack: errors.append(f"recommended_pack missing field: {field}")
    return {"valid": len(errors)==0, "errors": errors}

def validate_trigger_promotion_consistency(trigger_bundle, promotion_bundle):
    errors = []
    triggers = trigger_bundle.get("triggers", [])
    promotions = promotion_bundle.get("promotions", [])
    trigger_types = {t.get("trigger_type") for t in triggers if isinstance(t, dict)}
    if "inactivity" in trigger_types:
        promo_types = {p.get("trigger_type") for p in promotions if isinstance(p, dict)}
        if "inactivity" not in promo_types: errors.append("inactivity trigger exists but comeback promotion not generated")
    if "usage_critical" in trigger_types or "wallet_empty" in trigger_types:
        promo_types = {p.get("type") for p in promotions if isinstance(p, dict)}
        if "topup_discount" not in promo_types and "topup_bonus" not in promo_types:
            errors.append("critical usage trigger exists but no urgency/topup promo generated")
    return {"valid": len(errors)==0, "errors": errors}

def validate_funnel_analysis_consistency(funnel_summary, funnel_analysis):
    errors = []
    if funnel_summary.get("tenant_id") != funnel_analysis.get("tenant_id"):
        errors.append("tenant_id mismatch between funnel_summary and funnel_analysis")
    biggest_drop_stage = funnel_analysis.get("biggest_drop_stage")
    stage_analysis = funnel_analysis.get("stage_analysis", {})
    biggest_drop = stage_analysis.get("biggest_drop", {}) if isinstance(stage_analysis, dict) else {}
    if biggest_drop_stage != biggest_drop.get("stage"):
        errors.append("biggest_drop_stage mismatch with stage_analysis.biggest_drop.stage")
    recommendations = funnel_analysis.get("recommendations", [])
    if not isinstance(recommendations, list): errors.append("recommendations must be a list")
    elif len(recommendations) == 0: errors.append("funnel_analysis should produce at least one recommendation")
    return {"valid": len(errors)==0, "errors": errors}

def validate_growth_snapshot_consistency(snapshot):
    errors = []
    triggers_block = snapshot.get("growth_triggers", {})
    recommendation_block = snapshot.get("topup_recommendation", {})
    promotions_block = snapshot.get("automated_promotions", {})
    funnel_summary_block = snapshot.get("funnel_summary", {})
    funnel_analysis_block = snapshot.get("funnel_analysis", {})
    trigger_result = triggers_block.get("result", {})
    recommendation_result = recommendation_block.get("result", {})
    promotions_result = promotions_block.get("result", {})
    funnel_summary_result = funnel_summary_block.get("result", {})
    funnel_analysis_result = funnel_analysis_block.get("result", {})
    tenants = [trigger_result.get("tenant_id"), recommendation_result.get("tenant_id"), promotions_result.get("tenant_id"), funnel_summary_result.get("tenant_id"), funnel_analysis_result.get("tenant_id")]
    normalized = [t for t in tenants if t is not None]
    if normalized and len(set(normalized)) != 1: errors.append("tenant_id mismatch across growth snapshot components")
    _append_prefixed_errors(errors, "trigger_recommendation", validate_trigger_recommendation_consistency(trigger_bundle=trigger_result, recommendation=recommendation_result))
    _append_prefixed_errors(errors, "trigger_promotion", validate_trigger_promotion_consistency(trigger_bundle=trigger_result, promotion_bundle=promotions_result))
    _append_prefixed_errors(errors, "funnel_consistency", validate_funnel_analysis_consistency(funnel_summary=funnel_summary_result, funnel_analysis=funnel_analysis_result))
    return {"valid": len(errors)==0, "errors": errors}

def validate_growth_bundle(trigger_bundle=None, recommendation=None, promotion_bundle=None, funnel_summary=None, funnel_analysis=None, growth_snapshot=None, priority_action=None):
    errors = []
    if trigger_bundle is not None: _append_prefixed_errors(errors, "trigger_bundle", validate_trigger_bundle(trigger_bundle))
    if recommendation is not None: _append_prefixed_errors(errors, "recommendation", validate_topup_recommendation(recommendation))
    if promotion_bundle is not None: _append_prefixed_errors(errors, "promotion_bundle", validate_automated_promotion_bundle(promotion_bundle))
    if funnel_summary is not None: _append_prefixed_errors(errors, "funnel_summary", validate_funnel_summary(funnel_summary))
    if funnel_analysis is not None: _append_prefixed_errors(errors, "funnel_analysis", validate_funnel_analysis(funnel_analysis))
    if growth_snapshot is not None:
        _append_prefixed_errors(errors, "growth_snapshot", validate_growth_snapshot(growth_snapshot))
        _append_prefixed_errors(errors, "growth_snapshot_consistency", validate_growth_snapshot_consistency(growth_snapshot))
    if priority_action is not None: _append_prefixed_errors(errors, "priority_action", validate_priority_action(priority_action))
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== GROWTH VALIDATOR TEST ===")
    print("Import OK")
