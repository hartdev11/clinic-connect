from __future__ import annotations
import json
from datetime import datetime
from typing import Any, Dict, Optional

PROMOTION_USAGE_STORE: Dict[str, Dict[str, int]] = {}

def _now():
    return datetime.utcnow()

def _is_within_schedule(promo):
    schedule = promo.get("schedule", {})
    now = _now()
    starts_at = schedule.get("starts_at")
    ends_at = schedule.get("ends_at")
    if starts_at and now < datetime.fromisoformat(starts_at.replace("Z", "")): return False
    if ends_at and now > datetime.fromisoformat(ends_at.replace("Z", "")): return False
    return True

def _get_usage(promotion_id, tenant_id):
    return PROMOTION_USAGE_STORE.get(promotion_id, {}).get(tenant_id, 0)

def _increment_usage(promotion_id, tenant_id):
    if promotion_id not in PROMOTION_USAGE_STORE: PROMOTION_USAGE_STORE[promotion_id] = {}
    PROMOTION_USAGE_STORE[promotion_id][tenant_id] = PROMOTION_USAGE_STORE[promotion_id].get(tenant_id, 0) + 1

def _get_global_usage(promotion_id):
    return sum(PROMOTION_USAGE_STORE.get(promotion_id, {}).values())

def load_pricing_config(path="pricing_config_schema.json"):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def get_promotion(config, promotion_id):
    for p in config.get("promotions", []):
        if p.get("promotion_id") == promotion_id and p.get("is_active", True): return p
    return None

def validate_promotion(promotion_id, context, config_path="pricing_config_schema.json"):
    config = load_pricing_config(config_path)
    promo = get_promotion(config, promotion_id)
    if not promo: return {"valid": False, "reason": "promotion_not_found"}
    if not _is_within_schedule(promo): return {"valid": False, "reason": "promotion_not_active_in_time"}
    target = promo.get("target", {})
    limits = promo.get("limits", {})
    tenant_id = context.get("tenant_id")
    if target.get("new_tenant_only") and not context.get("is_new_tenant", False): return {"valid": False, "reason": "not_new_tenant"}
    if "plan_ids" in target and context.get("plan_id") not in target.get("plan_ids", []): return {"valid": False, "reason": "plan_not_eligible"}
    if target.get("first_topup_only") and not context.get("is_first_topup", False): return {"valid": False, "reason": "not_first_topup"}
    if target.get("affiliate_only") and not context.get("is_affiliate", False): return {"valid": False, "reason": "not_affiliate"}
    max_global = target.get("max_global_redemptions")
    if max_global is not None and _get_global_usage(promotion_id) >= max_global: return {"valid": False, "reason": "global_limit_reached"}
    if limits.get("once_per_tenant") and _get_usage(promotion_id, tenant_id) >= 1: return {"valid": False, "reason": "already_used"}
    return {"valid": True, "promotion": promo}

def apply_promotion(base_price, base_tokens, promotion_id, context, config_path="pricing_config_schema.json"):
    validation = validate_promotion(promotion_id, context, config_path)
    if not validation.get("valid"): return {"applied": False, "reason": validation.get("reason"), "final_price": base_price, "bonus_tokens": 0}
    promo = validation["promotion"]
    discount_amount = 0.0
    bonus_tokens = 0
    final_price = base_price
    if "discount" in promo:
        mode = promo["discount"].get("mode")
        value = float(promo["discount"].get("value", 0))
        if mode == "percent": discount_amount = base_price * (value / 100.0)
        elif mode == "fixed": discount_amount = value
        final_price = max(base_price - discount_amount, 0)
    if "bonus" in promo:
        if promo["bonus"].get("mode") == "percent_bonus_tokens":
            bonus_tokens = int(base_tokens * (float(promo["bonus"].get("value", 0)) / 100.0))
    return {"applied": True, "promotion_id": promotion_id, "discount_amount": round(discount_amount, 2), "final_price": round(final_price, 2), "bonus_tokens": bonus_tokens, "duration": promo.get("duration")}

def record_promotion_usage(promotion_id, tenant_id):
    _increment_usage(promotion_id, tenant_id)

if __name__ == "__main__":
    print("=== PROMOTION TEST ===")
    context = {"tenant_id": "tenant_1", "is_new_tenant": True, "plan_id": "growth"}
    result = apply_promotion(base_price=9900, base_tokens=0, promotion_id="early_20_growth_50_6m", context=context)
    print(result)
