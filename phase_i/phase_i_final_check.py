from __future__ import annotations
import sys
from copy import deepcopy
from typing import Any, Dict, List
from subscription_manager import create_subscription
from topup_manager import create_topup_order, confirm_topup_payment
from wallet_manager import get_wallet
from usage_tracker import track_usage
from usage_alert_engine import build_usage_alert, validate_alert
from invoice_generator import create_invoice, get_invoice
from payment_stub import process_payment
from monetization_validator import (
    validate_subscription, validate_topup_order, validate_wallet,
    validate_usage_result, validate_alert as val_alert, validate_invoice,
    validate_payment, validate_bundle,
)
from idempotency_manager import resolve_idempotent_execution, get_idempotency_record, validate_idempotency_record

def _print_header(title): print(f"\n=== {title} ===")
def _ok(msg): print(f"[PASS] {msg}")
def _fail(msg): print(f"[FAIL] {msg}")

def _collect(label, result, errors):
    if result.get("valid", False): _ok(label)
    else:
        _fail(label)
        for err in result.get("errors", []): errors.append(f"{label}: {err}"); print(f"  - {err}")

def main():
    errors = []
    TENANT_ID = "tenant_phase_i_final"
    PLAN_ID = "growth"
    SUB_PROMO_ID = "early_20_growth_50_6m"
    TOPUP_PACK_ID = "small"
    TOPUP_PROMO_ID = "first_topup_bonus_20"

    _print_header("PHASE I FINAL CHECK")

    _print_header("STEP 1 - SUBSCRIPTION PURCHASE")
    sub_result = create_subscription(tenant_id=TENANT_ID, plan_id=PLAN_ID, promotion_id=SUB_PROMO_ID, context={"is_new_tenant": True})
    subscription = sub_result["subscription"]
    _collect("subscription validation", validate_subscription(subscription), errors)
    if sub_result.get("payment_required") is True: _ok("subscription payment_required = True")
    else: _fail("subscription payment_required = True"); errors.append("subscription should require payment")

    _print_header("STEP 2 - SUBSCRIPTION INVOICE")
    sub_invoice = create_invoice(tenant_id=TENANT_ID, source_type="subscription", source_id=subscription["subscription_id"], base_price=subscription["base_price"], final_price=subscription["final_price"], discount_amount=subscription["discount_amount"], metadata={"plan_id": PLAN_ID})
    _collect("subscription invoice validation", validate_invoice(sub_invoice), errors)

    _print_header("STEP 3 - SUBSCRIPTION PAYMENT")
    sub_payment_result = process_payment(invoice_id=sub_invoice["invoice_id"], method="manual_transfer", simulate_status="paid")
    if sub_payment_result.get("success"): _ok("subscription payment processed")
    else: _fail("subscription payment processed"); errors.append(f"subscription payment failed: {sub_payment_result}")
    sub_payment = sub_payment_result.get("payment", {})
    paid_sub_invoice = get_invoice(sub_invoice["invoice_id"]) or sub_invoice
    _collect("subscription payment validation", validate_payment(sub_payment), errors)
    _collect("paid subscription invoice validation", validate_invoice(paid_sub_invoice), errors)
    if paid_sub_invoice.get("status") == "paid": _ok("subscription invoice marked paid")
    else: _fail("subscription invoice marked paid"); errors.append("subscription invoice must be paid after payment")

    _print_header("STEP 4 - TOPUP ORDER")
    topup_result = create_topup_order(tenant_id=TENANT_ID, pack_id=TOPUP_PACK_ID, promotion_id=TOPUP_PROMO_ID, context={"is_first_topup": True})
    topup_order = topup_result["order"]
    _collect("topup order validation", validate_topup_order(topup_order), errors)
    if topup_result.get("payment_required") is True: _ok("topup payment_required = True")
    else: _fail("topup payment_required = True"); errors.append("topup should require payment")

    _print_header("STEP 5 - TOPUP INVOICE")
    topup_invoice = create_invoice(tenant_id=TENANT_ID, source_type="topup", source_id=topup_order["order_id"], base_price=topup_order["base_price"], final_price=topup_order["final_price"], discount_amount=topup_order["discount_amount"], metadata={"pack_id": TOPUP_PACK_ID})
    _collect("topup invoice validation", validate_invoice(topup_invoice), errors)

    _print_header("STEP 6 - TOPUP PAYMENT")
    topup_payment_result = process_payment(invoice_id=topup_invoice["invoice_id"], method="manual_transfer", simulate_status="paid")
    if topup_payment_result.get("success"): _ok("topup payment processed")
    else: _fail("topup payment processed"); errors.append(f"topup payment failed: {topup_payment_result}")
    topup_payment = topup_payment_result.get("payment", {})
    paid_topup_invoice = get_invoice(topup_invoice["invoice_id"]) or topup_invoice
    _collect("topup payment validation", validate_payment(topup_payment), errors)
    _collect("paid topup invoice validation", validate_invoice(paid_topup_invoice), errors)
    if paid_topup_invoice.get("status") == "paid": _ok("topup invoice marked paid")
    else: _fail("topup invoice marked paid"); errors.append("topup invoice must be paid after payment")

    _print_header("STEP 7 - CONFIRM TOPUP TO WALLET")
    wallet_before = deepcopy(get_wallet(TENANT_ID))
    confirm_result = confirm_topup_payment(topup_order["order_id"])
    wallet_after = deepcopy(get_wallet(TENANT_ID))
    if confirm_result.get("success"): _ok("topup confirmed to wallet")
    else: _fail("topup confirmed to wallet"); errors.append(f"topup confirmation failed: {confirm_result}")
    _collect("wallet validation after topup", validate_wallet(wallet_after), errors)
    if wallet_after.get("balance_tokens", 0) > wallet_before.get("balance_tokens", 0): _ok("wallet balance increased after topup")
    else: _fail("wallet balance increased after topup"); errors.append("wallet balance did not increase after topup")

    _print_header("STEP 8 - USAGE TRACKING")
    usage_result = track_usage(tenant_id=TENANT_ID, usage_type="llm_tokens", payload={"tokens_used": 100, "ref_id": "req_final_check_001"})
    _collect("usage result validation", validate_usage_result(usage_result), errors)
    if usage_result.get("success"): _ok("usage tracked successfully")
    else: _fail("usage tracked successfully"); errors.append(f"usage tracking failed: {usage_result}")

    _print_header("STEP 9 - ALERT ENGINE")
    alert = build_usage_alert(tenant_id=TENANT_ID, included_tokens=1000)
    _collect("alert validation", val_alert(alert), errors)
    if alert.get("level") in {"safe","warning_70","warning_85","critical_100"}: _ok("alert level valid")
    else: _fail("alert level valid"); errors.append("invalid alert level returned")

    _print_header("STEP 10 - BUNDLE CONSISTENCY")
    bundle_result = validate_bundle(subscription=subscription, topup_order=topup_order, invoice=topup_invoice, payment=topup_payment, wallet_before=wallet_before, wallet_after=wallet_after)
    _collect("bundle consistency validation", bundle_result, errors)

    _print_header("STEP 11 - IDEMPOTENCY TEST")
    def topup_handler():
        return {"order_id": topup_order["order_id"], "status": "paid"}
    first = resolve_idempotent_execution(tenant_id=TENANT_ID, action="topup_purchase", resource_id=TOPUP_PACK_ID, fingerprint={"pack_id": TOPUP_PACK_ID, "promotion_id": TOPUP_PROMO_ID}, handler=topup_handler)
    second = resolve_idempotent_execution(tenant_id=TENANT_ID, action="topup_purchase", resource_id=TOPUP_PACK_ID, fingerprint={"pack_id": TOPUP_PACK_ID, "promotion_id": TOPUP_PROMO_ID}, handler=topup_handler)
    if first.get("success"): _ok("idempotency first execution success")
    else: _fail("idempotency first execution success"); errors.append("idempotency first execution failed")
    if second.get("reused") is True: _ok("idempotency second execution reused")
    else: _fail("idempotency second execution reused"); errors.append("idempotency should reuse on second call")
    idem_record = get_idempotency_record(first["idempotency_key"])
    if idem_record: _collect("idempotency record validation", validate_idempotency_record(idem_record), errors)
    else: _fail("idempotency record not found"); errors.append("idempotency record missing")

    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL\n")
        for e in errors: print(f" - {e}")
        return 1
    print("FINAL RESULT: PASS — PHASE I PREPAID PRODUCTION COMPLETE")
    return 0

if __name__ == "__main__":
    sys.exit(main())
