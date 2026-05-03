from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from usage_trigger_engine import build_usage_triggers
from topup_recommendation_engine import build_topup_recommendation

AUTO_PROMOTION_STORE: Dict[str, Dict[str, Any]] = {}

DEFAULT_PROMOTION_AUTOMATION_CONFIG = {
    "enable_comeback_promo": True,
    "enable_topup_boost_promo": True,
    "enable_upgrade_discount_promo": True,
    "enable_urgency_discount_promo": True,
    "comeback_discount_percent": 10,
    "topup_bonus_percent": 20,
    "upgrade_discount_percent": 15,
    "urgency_discount_percent": 5,
    "default_expiry_days": 3,
}

def _now(): return datetime.utcnow()
def _now_iso(): return _now().replace(microsecond=0).isoformat() + "Z"
def _safe_int(v):
    try: return int(v)
    except: return 0
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _build_promotion_id(prefix, tenant_id):
    return f"{prefix}_{tenant_id}_{_now().strftime('%Y%m%d%H%M%S')}"
def _expires_at(days):
    return (_now() + timedelta(days=days)).replace(microsecond=0).isoformat() + "Z"
def _store_promotion(promo):
    AUTO_PROMOTION_STORE[promo["promotion_id"]] = dict(promo)
    return promo

def build_comeback_promotion(tenant_id, discount_percent=10, expiry_days=3):
    return _store_promotion({"promotion_id":_build_promotion_id("auto_comeback",tenant_id),"tenant_id":tenant_id,"name":"Comeback Promo","type":"subscription_discount","trigger_type":"inactivity","discount":{"mode":"percent","value":discount_percent},"bonus":None,"duration":{"mode":"one_time","value":1},"target":{"tenant_only":True},"schedule":{"starts_at":_now_iso(),"ends_at":_expires_at(expiry_days)},"limits":{"once_per_tenant":True,"combinable":False},"status":"active","created_at":_now_iso()})

def build_topup_boost_promotion(tenant_id, recommended_pack_id, bonus_percent=20, expiry_days=3):
    return _store_promotion({"promotion_id":_build_promotion_id("auto_topup_boost",tenant_id),"tenant_id":tenant_id,"name":"Top-up Boost Promo","type":"topup_bonus","trigger_type":"usage_warning","discount":None,"bonus":{"mode":"percent_bonus_tokens","value":bonus_percent},"duration":{"mode":"one_time","value":1},"target":{"tenant_only":True,"eligible_pack_ids":[recommended_pack_id]},"schedule":{"starts_at":_now_iso(),"ends_at":_expires_at(expiry_days)},"limits":{"once_per_tenant":True,"combinable":False},"status":"active","created_at":_now_iso()})

def build_upgrade_discount_promotion(tenant_id, current_plan_id, target_plan_ids=None, discount_percent=15, expiry_days=3):
    target_plan_ids = target_plan_ids or ["pro","enterprise"]
    return _store_promotion({"promotion_id":_build_promotion_id("auto_upgrade_discount",tenant_id),"tenant_id":tenant_id,"name":"Upgrade Discount Promo","type":"plan_upgrade_discount","trigger_type":"high_booking_intent","discount":{"mode":"percent","value":discount_percent},"bonus":None,"duration":{"mode":"one_time","value":1},"target":{"tenant_only":True,"current_plan_id":current_plan_id,"plan_ids":target_plan_ids},"schedule":{"starts_at":_now_iso(),"ends_at":_expires_at(expiry_days)},"limits":{"once_per_tenant":True,"combinable":False},"status":"active","created_at":_now_iso()})

def build_urgency_discount_promotion(tenant_id, recommended_pack_id, discount_percent=5, expiry_days=1):
    return _store_promotion({"promotion_id":_build_promotion_id("auto_urgency_discount",tenant_id),"tenant_id":tenant_id,"name":"Urgency Top-up Discount","type":"topup_discount","trigger_type":"usage_critical","discount":{"mode":"percent","value":discount_percent},"bonus":None,"duration":{"mode":"one_time","value":1},"target":{"tenant_only":True,"eligible_pack_ids":[recommended_pack_id]},"schedule":{"starts_at":_now_iso(),"ends_at":_expires_at(expiry_days)},"limits":{"once_per_tenant":True,"combinable":False},"status":"active","created_at":_now_iso()})

def build_automated_promotions(tenant_id, included_tokens, current_plan_id, estimated_cost_per_action=1, phase_k_metrics=None, config=None):
    config = {**DEFAULT_PROMOTION_AUTOMATION_CONFIG, **(config or {})}
    trigger_bundle = build_usage_triggers(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    recommendation = build_topup_recommendation(tenant_id=tenant_id, included_tokens=included_tokens, estimated_cost_per_action=estimated_cost_per_action, phase_k_metrics=phase_k_metrics)
    promotions = []
    highest = trigger_bundle.get("highest_priority_trigger") or {}
    highest_type = highest.get("trigger_type")
    highest_level = highest.get("level")
    if config["enable_comeback_promo"]:
        for trig in trigger_bundle.get("triggers", []):
            if trig.get("trigger_type") == "inactivity":
                promotions.append(build_comeback_promotion(tenant_id=tenant_id, discount_percent=config["comeback_discount_percent"], expiry_days=config["default_expiry_days"]))
                break
    if config["enable_topup_boost_promo"] and recommendation.get("recommended_pack") is not None and recommendation.get("urgency") in {"medium","high"}:
        promotions.append(build_topup_boost_promotion(tenant_id=tenant_id, recommended_pack_id=recommendation["recommended_pack"]["pack_id"], bonus_percent=config["topup_bonus_percent"], expiry_days=config["default_expiry_days"]))
    if config["enable_upgrade_discount_promo"]:
        for trig in trigger_bundle.get("triggers", []):
            if trig.get("trigger_type") == "high_booking_intent":
                promotions.append(build_upgrade_discount_promotion(tenant_id=tenant_id, current_plan_id=current_plan_id, discount_percent=config["upgrade_discount_percent"], expiry_days=config["default_expiry_days"]))
                break
    if config["enable_urgency_discount_promo"] and recommendation.get("recommended_pack") is not None and highest_type in {"usage_critical","wallet_empty"} and highest_level == "critical":
        promotions.append(build_urgency_discount_promotion(tenant_id=tenant_id, recommended_pack_id=recommendation["recommended_pack"]["pack_id"], discount_percent=config["urgency_discount_percent"], expiry_days=1))
    return {"tenant_id":tenant_id,"trigger_bundle":trigger_bundle,"recommendation":recommendation,"promotion_count":len(promotions),"promotions":promotions,"generated_at":_now_iso()}

def get_automated_promotion(promotion_id):
    return AUTO_PROMOTION_STORE.get(promotion_id)

def get_automated_promotions_by_tenant(tenant_id):
    return [p for p in AUTO_PROMOTION_STORE.values() if p.get("tenant_id") == tenant_id]

def validate_automated_promotion_bundle(bundle):
    errors = []
    for field in ["tenant_id","trigger_bundle","recommendation","promotion_count","promotions","generated_at"]:
        if field not in bundle: errors.append(f"missing field: {field}")
    if not isinstance(bundle.get("promotions",[]), list): errors.append("promotions must be a list")
    if not isinstance(bundle.get("trigger_bundle",{}), dict): errors.append("trigger_bundle must be a dict")
    if not isinstance(bundle.get("recommendation",{}), dict): errors.append("recommendation must be a dict")
    for idx, promo in enumerate(bundle.get("promotions",[])):
        if not isinstance(promo, dict): errors.append(f"promotions[{idx}] must be a dict"); continue
        for field in ["promotion_id","tenant_id","name","type","status","created_at"]:
            if field not in promo: errors.append(f"promotions[{idx}] missing field: {field}")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from wallet_manager import create_wallet, add_tokens
    from usage_tracker import track_usage
    print("=== PROMOTION AUTOMATION ENGINE TEST ===")
    tenant = "tenant_h3_demo"
    create_wallet(tenant)
    add_tokens(tenant, 500, source="seed")
    track_usage(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used":420,"ref_id":"req_h3_001"})
    phase_k_metrics = {"overview":{"total_sessions":120,"total_bookings":10,"total_revenue":30000},"funnel":{"view":200,"click":80,"booking":10},"bookings":{"summary":{"pending":5,"confirmed":3,"completed":2}}}
    bundle = build_automated_promotions(tenant_id=tenant, included_tokens=1000, current_plan_id="growth", estimated_cost_per_action=10, phase_k_metrics=phase_k_metrics)
    print(bundle)
    print(validate_automated_promotion_bundle(bundle))
