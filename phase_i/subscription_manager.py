from __future__ import annotations
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import uuid
from pricing_resolver import resolve_subscription_price
from promotion_manager import apply_promotion, record_promotion_usage

SUBSCRIPTIONS = {}

def _now():
    return datetime.utcnow()

def _generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

def create_subscription(tenant_id, plan_id, promotion_id=None, context=None):
    context = context or {}
    pricing = resolve_subscription_price(plan_id=plan_id, promotion_id=None, context=context)
    base_price = pricing["base_price"]
    promo_result = None
    final_price = base_price
    discount_amount = 0.0
    if promotion_id:
        promo_result = apply_promotion(base_price=base_price, base_tokens=0, promotion_id=promotion_id, context={**context, "tenant_id": tenant_id, "plan_id": plan_id})
        if promo_result.get("applied"):
            final_price = promo_result["final_price"]
            discount_amount = promo_result["discount_amount"]
            record_promotion_usage(promotion_id, tenant_id)
    start_at = _now()
    end_at = start_at + timedelta(days=30)
    subscription_id = _generate_id("sub")
    subscription = {
        "subscription_id": subscription_id,
        "tenant_id": tenant_id,
        "plan_id": plan_id,
        "status": "active",
        "started_at": start_at.isoformat(),
        "expires_at": end_at.isoformat(),
        "base_price": base_price,
        "final_price": final_price,
        "discount_amount": discount_amount,
        "promotion_id": promotion_id,
        "created_at": _now().isoformat(),
    }
    SUBSCRIPTIONS[subscription_id] = subscription
    return {"subscription": subscription, "payment_required": final_price > 0}

def get_subscription(subscription_id):
    return SUBSCRIPTIONS.get(subscription_id)

def cancel_subscription(subscription_id):
    sub = SUBSCRIPTIONS.get(subscription_id)
    if not sub: return {"success": False, "reason": "not_found"}
    sub["status"] = "cancelled"
    sub["cancelled_at"] = _now().isoformat()
    return {"success": True, "subscription": sub}

if __name__ == "__main__":
    print("=== SUBSCRIPTION TEST ===")
    result = create_subscription(tenant_id="tenant_001", plan_id="growth", promotion_id="early_20_growth_50_6m", context={"is_new_tenant": True})
    print(result)
