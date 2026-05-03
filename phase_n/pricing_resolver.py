from __future__ import annotations
import json
from datetime import datetime
from typing import Any, Dict, List, Optional

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _safe_int(v):
    try: return int(v)
    except: return 0

def load_pricing_config(path="pricing_config_schema.json"):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def _find_plan(config, plan_id):
    for p in config.get("plans", []):
        if p.get("plan_id") == plan_id and p.get("is_active", True):
            return p
    raise ValueError(f"plan not found: {plan_id}")

def _find_topup_pack(config, pack_id):
    for p in config.get("topup_rules", {}).get("packs", []):
        if p.get("pack_id") == pack_id and p.get("is_active", True):
            return p
    raise ValueError(f"topup pack not found: {pack_id}")

def _find_promotion(config, promotion_id):
    if not promotion_id: return None
    for p in config.get("promotions", []):
        if p.get("promotion_id") == promotion_id and p.get("is_active", True):
            return p
    return None

def _validate_promotion(promo, context):
    if not promo: return False
    target = promo.get("target", {})
    if target.get("new_tenant_only") and not context.get("is_new_tenant", False): return False
    if "plan_ids" in target and context.get("plan_id") not in target.get("plan_ids", []): return False
    if target.get("first_topup_only") and not context.get("is_first_topup", False): return False
    return True

def _apply_discount(base_price, promo):
    discount = promo.get("discount", {})
    mode = discount.get("mode")
    value = _safe_float(discount.get("value"))
    if mode == "percent": discount_amount = base_price * (value / 100.0)
    elif mode == "fixed": discount_amount = value
    else: discount_amount = 0.0
    return {"discount_amount": round(discount_amount, 2), "final_price": round(max(base_price - discount_amount, 0), 2)}

def _apply_topup_bonus(tokens, promo):
    bonus = promo.get("bonus", {})
    if bonus.get("mode") == "percent_bonus_tokens":
        return int(tokens * (_safe_float(bonus.get("value")) / 100.0))
    return 0

def resolve_subscription_price(plan_id, promotion_id=None, context=None, config_path="pricing_config_schema.json"):
    config = load_pricing_config(config_path)
    context = context or {}
    plan = _find_plan(config, plan_id)
    base_price = _safe_float(plan.get("base_price"))
    promo = _find_promotion(config, promotion_id)
    discount_amount = 0.0
    final_price = base_price
    if promo and _validate_promotion(promo, {**context, "plan_id": plan_id}):
        if promo.get("type") == "subscription_discount":
            res = _apply_discount(base_price, promo)
            discount_amount = res["discount_amount"]
            final_price = res["final_price"]
    return {"type":"subscription","plan_id":plan_id,"base_price":base_price,"discount_amount":discount_amount,"final_price":final_price,"currency":config.get("currency","THB"),"promotion_id":promotion_id,"timestamp":_now_iso()}

def resolve_topup_price(pack_id, promotion_id=None, context=None, config_path="pricing_config_schema.json"):
    config = load_pricing_config(config_path)
    context = context or {}
    pack = _find_topup_pack(config, pack_id)
    base_price = _safe_float(pack.get("price"))
    base_tokens = _safe_int(pack.get("tokens"))
    bonus_tokens = _safe_int(pack.get("bonus_tokens", 0))
    promo = _find_promotion(config, promotion_id)
    discount_amount = 0.0
    final_price = base_price
    promo_bonus_tokens = 0
    if promo and _validate_promotion(promo, context):
        if promo.get("type") == "topup_discount":
            res = _apply_discount(base_price, promo)
            discount_amount = res["discount_amount"]
            final_price = res["final_price"]
        if promo.get("type") == "topup_bonus":
            promo_bonus_tokens = _apply_topup_bonus(base_tokens, promo)
    total_tokens = base_tokens + bonus_tokens + promo_bonus_tokens
    return {"type":"topup","pack_id":pack_id,"base_price":base_price,"final_price":final_price,"discount_amount":discount_amount,"base_tokens":base_tokens,"bonus_tokens":bonus_tokens,"promo_bonus_tokens":promo_bonus_tokens,"total_tokens":total_tokens,"currency":config.get("currency","THB"),"promotion_id":promotion_id,"timestamp":_now_iso()}

def validate_pricing_result(result):
    errors = []
    if _safe_float(result.get("final_price", 0)) < 0: errors.append("final_price cannot be negative")
    if result.get("type") == "topup" and _safe_int(result.get("total_tokens", 0)) <= 0: errors.append("tokens must be > 0")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== PRICING RESOLVER TEST ===")
    sub = resolve_subscription_price(plan_id="growth", promotion_id="early_20_growth_50_6m", context={"is_new_tenant": True})
    print("SUB:", sub)
    topup = resolve_topup_price(pack_id="small", promotion_id="first_topup_bonus_20", context={"is_first_topup": True})
    print("TOPUP:", topup)
    print("VALID:", validate_pricing_result(topup))
