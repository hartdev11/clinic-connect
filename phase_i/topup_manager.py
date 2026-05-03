from __future__ import annotations
from typing import Dict, Any, Optional
import uuid
from datetime import datetime
from pricing_resolver import resolve_topup_price
from promotion_manager import apply_promotion, record_promotion_usage
from wallet_manager import add_tokens

TOPUP_ORDERS = {}

def _now():
    return datetime.utcnow().isoformat()

def _generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

def create_topup_order(tenant_id, pack_id, promotion_id=None, context=None):
    context = context or {}
    pricing = resolve_topup_price(pack_id=pack_id, promotion_id=None, context=context)
    base_price = pricing["base_price"]
    base_tokens = pricing["base_tokens"]
    final_price = base_price
    bonus_tokens = 0
    discount_amount = 0.0
    if promotion_id:
        promo_result = apply_promotion(base_price=base_price, base_tokens=base_tokens, promotion_id=promotion_id, context={**context, "tenant_id": tenant_id})
        if promo_result.get("applied"):
            final_price = promo_result["final_price"]
            bonus_tokens = promo_result["bonus_tokens"]
            discount_amount = promo_result["discount_amount"]
            record_promotion_usage(promotion_id, tenant_id)
    total_tokens = base_tokens + bonus_tokens
    order_id = _generate_id("topup")
    order = {
        "order_id": order_id,
        "tenant_id": tenant_id,
        "pack_id": pack_id,
        "base_price": base_price,
        "final_price": final_price,
        "discount_amount": discount_amount,
        "base_tokens": base_tokens,
        "bonus_tokens": bonus_tokens,
        "total_tokens": total_tokens,
        "promotion_id": promotion_id,
        "status": "pending_payment",
        "created_at": _now(),
    }
    TOPUP_ORDERS[order_id] = order
    return {"order": order, "payment_required": final_price > 0}

def confirm_topup_payment(order_id):
    order = TOPUP_ORDERS.get(order_id)
    if not order: return {"success": False, "reason": "order_not_found"}
    if order["status"] == "paid": return {"success": True, "message": "already_paid"}
    wallet = add_tokens(tenant_id=order["tenant_id"], amount=order["total_tokens"], source="topup", reference_id=order_id)
    order["status"] = "paid"
    order["paid_at"] = _now()
    return {"success": True, "wallet": wallet, "order": order}

def get_topup_order(order_id):
    return TOPUP_ORDERS.get(order_id)

if __name__ == "__main__":
    print("=== TOPUP TEST ===")
    tenant = "tenant_001"
    order = create_topup_order(tenant_id=tenant, pack_id="small", promotion_id="first_topup_bonus_20", context={"is_first_topup": True})
    print("ORDER:", order)
    confirm = confirm_topup_payment(order["order"]["order_id"])
    print("CONFIRM:", confirm)
