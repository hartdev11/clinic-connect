from __future__ import annotations
from typing import Dict, Any, Optional
from pricing_resolver import resolve_subscription_price, resolve_topup_price
from subscription_manager import create_subscription, get_subscription
from topup_manager import create_topup_order, confirm_topup_payment
from wallet_manager import get_wallet
from usage_tracker import track_usage
from usage_alert_engine import build_usage_alert
from invoice_generator import create_invoice, get_invoice
from payment_stub import process_payment

def get_plan_quote(plan_id, promotion_id=None, context=None):
    return resolve_subscription_price(plan_id=plan_id, promotion_id=promotion_id, context=context or {})

def purchase_subscription(tenant_id, plan_id, promotion_id=None, context=None):
    context = context or {}
    result = create_subscription(tenant_id=tenant_id, plan_id=plan_id, promotion_id=promotion_id, context=context)
    sub = result["subscription"]
    invoice = create_invoice(tenant_id=tenant_id, source_type="subscription", source_id=sub["subscription_id"], base_price=sub["base_price"], final_price=sub["final_price"], discount_amount=sub["discount_amount"], metadata={"plan_id": plan_id})
    return {"subscription": sub, "invoice": invoice, "payment_required": result["payment_required"]}

def purchase_topup(tenant_id, pack_id, promotion_id=None, context=None):
    context = context or {}
    result = create_topup_order(tenant_id=tenant_id, pack_id=pack_id, promotion_id=promotion_id, context=context)
    order = result["order"]
    invoice = create_invoice(tenant_id=tenant_id, source_type="topup", source_id=order["order_id"], base_price=order["base_price"], final_price=order["final_price"], discount_amount=order["discount_amount"], metadata={"pack_id": pack_id})
    return {"order": order, "invoice": invoice, "payment_required": result["payment_required"]}

def pay_invoice(invoice_id, method="manual_transfer"):
    return process_payment(invoice_id=invoice_id, method=method, simulate_status="paid")

def confirm_topup_after_payment(order_id):
    return confirm_topup_payment(order_id)

def get_wallet_info(tenant_id):
    return get_wallet(tenant_id)

def use_service(tenant_id, usage_type, payload):
    return track_usage(tenant_id=tenant_id, usage_type=usage_type, payload=payload)

def get_usage_alert(tenant_id, included_tokens):
    return build_usage_alert(tenant_id=tenant_id, included_tokens=included_tokens)

def get_invoice_detail(invoice_id):
    return get_invoice(invoice_id)

def full_flow_test():
    tenant = "tenant_demo"
    print("\n=== 1. SUBSCRIPTION PURCHASE ===")
    sub = purchase_subscription(tenant_id=tenant, plan_id="growth", promotion_id="early_20_growth_50_6m", context={"is_new_tenant": True})
    print(sub)
    print("\n=== 2. PAY SUBSCRIPTION ===")
    pay = pay_invoice(sub["invoice"]["invoice_id"])
    print(pay)
    print("\n=== 3. TOPUP PURCHASE ===")
    topup = purchase_topup(tenant_id=tenant, pack_id="small", promotion_id="first_topup_bonus_20", context={"is_first_topup": True})
    print(topup)
    print("\n=== 4. PAY TOPUP ===")
    pay2 = pay_invoice(topup["invoice"]["invoice_id"])
    print(pay2)
    print("\n=== 5. CONFIRM TOPUP TO WALLET ===")
    confirm = confirm_topup_after_payment(topup["order"]["order_id"])
    print(confirm)
    print("\n=== 6. USE SERVICE ===")
    usage = use_service(tenant_id=tenant, usage_type="llm_tokens", payload={"tokens_used": 100})
    print(usage)
    print("\n=== 7. ALERT ===")
    alert = get_usage_alert(tenant_id=tenant, included_tokens=1000)
    print(alert)
    print("\n=== 8. WALLET ===")
    wallet = get_wallet_info(tenant)
    print(wallet)

if __name__ == "__main__":
    full_flow_test()
