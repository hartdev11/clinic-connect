from __future__ import annotations
from typing import Any, Dict, List, Optional

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def _safe_int(v):
    try: return int(v)
    except: return 0

def _append_errors(errors, prefix, new_errors):
    for err in new_errors: errors.append(f"{prefix}: {err}")

def validate_subscription(subscription):
    errors = []
    required = ["subscription_id","tenant_id","plan_id","status","base_price","final_price","discount_amount","created_at"]
    for field in required:
        if field not in subscription: errors.append(f"missing field: {field}")
    if subscription.get("status") not in {"active","cancelled","expired","paused"}: errors.append("invalid status")
    if _safe_float(subscription.get("base_price",0)) < 0: errors.append("base_price cannot be negative")
    if _safe_float(subscription.get("final_price",0)) < 0: errors.append("final_price cannot be negative")
    if _safe_float(subscription.get("discount_amount",0)) < 0: errors.append("discount_amount cannot be negative")
    if _safe_float(subscription.get("final_price",0)) > _safe_float(subscription.get("base_price",0)): errors.append("final_price cannot exceed base_price")
    return {"valid": len(errors)==0, "errors": errors}

def validate_topup_order(order):
    errors = []
    required = ["order_id","tenant_id","pack_id","base_price","final_price","discount_amount","base_tokens","bonus_tokens","total_tokens","status","created_at"]
    for field in required:
        if field not in order: errors.append(f"missing field: {field}")
    if order.get("status") not in {"pending_payment","paid","failed"}: errors.append("invalid status")
    if _safe_float(order.get("base_price",0)) < 0: errors.append("base_price cannot be negative")
    if _safe_float(order.get("final_price",0)) < 0: errors.append("final_price cannot be negative")
    if _safe_int(order.get("total_tokens",0)) <= 0: errors.append("total_tokens must be > 0")
    if _safe_float(order.get("final_price",0)) > _safe_float(order.get("base_price",0)): errors.append("final_price cannot exceed base_price")
    return {"valid": len(errors)==0, "errors": errors}

def validate_wallet(wallet):
    errors = []
    required = ["tenant_id","balance_tokens","status","created_at","updated_at"]
    for field in required:
        if field not in wallet: errors.append(f"missing field: {field}")
    if wallet.get("status") not in {"active","suspended"}: errors.append("invalid status")
    if _safe_int(wallet.get("balance_tokens",0)) < 0: errors.append("balance_tokens cannot be negative")
    return {"valid": len(errors)==0, "errors": errors}

def validate_usage_result(result):
    errors = []
    if "success" not in result: errors.append("missing success")
    if result.get("success") is True:
        if _safe_int(result.get("cost",0)) <= 0: errors.append("cost must be > 0 when success=true")
        if _safe_int(result.get("remaining_balance",-1)) < 0: errors.append("remaining_balance cannot be negative")
    else:
        if "reason" not in result: errors.append("missing reason when success=false")
    return {"valid": len(errors)==0, "errors": errors}

def validate_alert(alert):
    errors = []
    required = ["tenant_id","level","should_topup","should_block","quota_alert","wallet_alert","message","timestamp"]
    for field in required:
        if field not in alert: errors.append(f"missing field: {field}")
    if alert.get("level") not in {"safe","warning_70","warning_85","critical_100"}: errors.append("invalid alert level")
    if not isinstance(alert.get("quota_alert",{}), dict): errors.append("quota_alert must be a dict")
    if not isinstance(alert.get("wallet_alert",{}), dict): errors.append("wallet_alert must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

def validate_invoice(invoice):
    errors = []
    required = ["invoice_id","tenant_id","source_type","source_id","base_price","discount_amount","final_price","tax_amount","total_amount","currency","status","created_at"]
    for field in required:
        if field not in invoice: errors.append(f"missing field: {field}")
    if invoice.get("status") not in {"pending","paid"}: errors.append("invalid invoice status")
    for field in ["base_price","discount_amount","final_price","tax_amount","total_amount"]:
        if _safe_float(invoice.get(field,0)) < 0: errors.append(f"{field} cannot be negative")
    expected_total = round(_safe_float(invoice.get("final_price",0)) + _safe_float(invoice.get("tax_amount",0)), 2)
    if round(_safe_float(invoice.get("total_amount",0)), 2) != expected_total: errors.append("total_amount mismatch")
    return {"valid": len(errors)==0, "errors": errors}

def validate_payment(payment):
    errors = []
    required = ["payment_id","invoice_id","tenant_id","amount","currency","method","status","payment_reference","retry_count","created_at","updated_at"]
    for field in required:
        if field not in payment: errors.append(f"missing field: {field}")
    if payment.get("status") not in {"pending","paid","failed"}: errors.append("invalid payment status")
    if _safe_float(payment.get("amount",0)) < 0: errors.append("amount cannot be negative")
    if _safe_int(payment.get("retry_count",0)) < 0: errors.append("retry_count cannot be negative")
    return {"valid": len(errors)==0, "errors": errors}

def validate_subscription_invoice(subscription, invoice):
    errors = []
    if subscription.get("tenant_id") != invoice.get("tenant_id"): errors.append("tenant_id mismatch")
    if invoice.get("source_type") != "subscription": errors.append("invoice source_type must be subscription")
    if invoice.get("source_id") != subscription.get("subscription_id"): errors.append("invoice source_id mismatch subscription_id")
    if round(_safe_float(invoice.get("base_price",0)),2) != round(_safe_float(subscription.get("base_price",0)),2): errors.append("invoice base_price mismatch subscription")
    if round(_safe_float(invoice.get("final_price",0)),2) != round(_safe_float(subscription.get("final_price",0)),2): errors.append("invoice final_price mismatch subscription")
    return {"valid": len(errors)==0, "errors": errors}

def validate_topup_invoice(order, invoice):
    errors = []
    if order.get("tenant_id") != invoice.get("tenant_id"): errors.append("tenant_id mismatch")
    if invoice.get("source_type") != "topup": errors.append("invoice source_type must be topup")
    if invoice.get("source_id") != order.get("order_id"): errors.append("invoice source_id mismatch order_id")
    if round(_safe_float(invoice.get("final_price",0)),2) != round(_safe_float(order.get("final_price",0)),2): errors.append("invoice final_price mismatch topup order")
    return {"valid": len(errors)==0, "errors": errors}

def validate_invoice_payment(invoice, payment):
    errors = []
    if invoice.get("invoice_id") != payment.get("invoice_id"): errors.append("invoice_id mismatch")
    if invoice.get("tenant_id") != payment.get("tenant_id"): errors.append("tenant_id mismatch")
    if round(_safe_float(invoice.get("total_amount",0)),2) != round(_safe_float(payment.get("amount",0)),2): errors.append("payment amount mismatch invoice total_amount")
    if payment.get("status") == "paid" and invoice.get("status") != "paid": errors.append("paid payment but invoice not paid")
    return {"valid": len(errors)==0, "errors": errors}

def validate_topup_wallet(order, wallet_before, wallet_after):
    errors = []
    expected_increase = _safe_int(order.get("total_tokens",0))
    before = _safe_int(wallet_before.get("balance_tokens",0))
    after = _safe_int(wallet_after.get("balance_tokens",0))
    if after != before + expected_increase: errors.append(f"wallet balance mismatch: expected {before+expected_increase} got {after}")
    return {"valid": len(errors)==0, "errors": errors}

def validate_bundle(subscription=None, topup_order=None, invoice=None, payment=None, wallet_before=None, wallet_after=None):
    errors = []
    if subscription and invoice and invoice.get("source_type")=="subscription":
        _append_errors(errors, "sub_invoice", validate_subscription_invoice(subscription, invoice).get("errors",[]))
    if topup_order and invoice and invoice.get("source_type")=="topup":
        _append_errors(errors, "topup_invoice", validate_topup_invoice(topup_order, invoice).get("errors",[]))
    if invoice and payment:
        _append_errors(errors, "invoice_payment", validate_invoice_payment(invoice, payment).get("errors",[]))
    if topup_order and wallet_before and wallet_after:
        _append_errors(errors, "topup_wallet", validate_topup_wallet(topup_order, wallet_before, wallet_after).get("errors",[]))
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== MONETIZATION VALIDATOR TEST ===")
    sub = {"subscription_id":"sub_001","tenant_id":"t1","plan_id":"growth","status":"active","base_price":9900,"final_price":4950,"discount_amount":4950,"created_at":"2026-01-01"}
    print(validate_subscription(sub))
