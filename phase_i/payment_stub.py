from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from invoice_generator import get_invoice, mark_invoice_paid

PAYMENTS: Dict[str, Dict[str, Any]] = {}

def _now():
    return datetime.utcnow().isoformat()

def _generate_payment_id():
    return f"PAY_{uuid.uuid4().hex[:10]}"

def _generate_payment_reference(prefix="stub"):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def create_payment_attempt(invoice_id, method="manual_transfer", metadata=None):
    metadata = metadata or {}
    invoice = get_invoice(invoice_id)
    if not invoice: return {"success": False, "reason": "invoice_not_found"}
    payment_id = _generate_payment_id()
    payment = {
        "payment_id": payment_id,
        "invoice_id": invoice_id,
        "tenant_id": invoice.get("tenant_id"),
        "source_type": invoice.get("source_type"),
        "source_id": invoice.get("source_id"),
        "amount": _safe_float(invoice.get("total_amount", 0)),
        "currency": invoice.get("currency", "THB"),
        "method": method,
        "status": "pending",
        "payment_reference": _generate_payment_reference(),
        "failure_reason": None,
        "retry_count": 0,
        "metadata": metadata,
        "created_at": _now(),
        "updated_at": _now(),
        "paid_at": None,
        "failed_at": None,
    }
    PAYMENTS[payment_id] = payment
    return {"success": True, "payment": payment}

def mark_payment_pending(payment_id, reason=None):
    payment = PAYMENTS.get(payment_id)
    if not payment: return {"success": False, "reason": "payment_not_found"}
    payment["status"] = "pending"
    payment["updated_at"] = _now()
    if reason: payment.setdefault("metadata",{}); payment["metadata"]["pending_reason"] = reason
    return {"success": True, "payment": payment}

def mark_payment_failed(payment_id, failure_reason):
    payment = PAYMENTS.get(payment_id)
    if not payment: return {"success": False, "reason": "payment_not_found"}
    payment["status"] = "failed"
    payment["failure_reason"] = failure_reason
    payment["retry_count"] = int(payment.get("retry_count", 0)) + 1
    payment["failed_at"] = _now()
    payment["updated_at"] = _now()
    return {"success": True, "payment": payment}

def mark_payment_paid(payment_id):
    payment = PAYMENTS.get(payment_id)
    if not payment: return {"success": False, "reason": "payment_not_found"}
    if payment["status"] == "paid": return {"success": True, "message": "already_paid", "payment": payment}
    payment["status"] = "paid"
    payment["paid_at"] = _now()
    payment["updated_at"] = _now()
    invoice_result = mark_invoice_paid(payment["invoice_id"])
    return {"success": True, "payment": payment, "invoice_result": invoice_result}

def process_payment(invoice_id, method="manual_transfer", simulate_status="paid"):
    payment_attempt = create_payment_attempt(invoice_id=invoice_id, method=method)
    if not payment_attempt.get("success"): return payment_attempt
    payment = payment_attempt["payment"]
    payment_id = payment["payment_id"]
    if simulate_status == "paid": return mark_payment_paid(payment_id)
    if simulate_status == "failed": return mark_payment_failed(payment_id, "payment_processing_failed")
    if simulate_status == "pending": return mark_payment_pending(payment_id)
    return {"success": False, "reason": "invalid_simulate_status"}

def get_payment(payment_id):
    return PAYMENTS.get(payment_id)

def get_payments_by_tenant(tenant_id):
    return [p for p in PAYMENTS.values() if p.get("tenant_id") == tenant_id]

def validate_payment(payment):
    errors = []
    required = ["payment_id","invoice_id","tenant_id","amount","currency","method","status","payment_reference","retry_count","created_at","updated_at"]
    for field in required:
        if field not in payment: errors.append(f"missing field: {field}")
    if payment.get("status") not in {"pending","paid","failed"}: errors.append("invalid payment status")
    if _safe_float(payment.get("amount",0)) < 0: errors.append("amount cannot be negative")
    try:
        if int(payment.get("retry_count",0)) < 0: errors.append("retry_count cannot be negative")
    except: errors.append("retry_count must be integer")
    if not isinstance(payment.get("metadata",{}), dict): errors.append("metadata must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from invoice_generator import create_invoice
    print("=== PAYMENT STUB TEST ===")
    invoice = create_invoice(tenant_id="tenant_001", source_type="topup", source_id="topup_001", base_price=500, final_price=500, discount_amount=0, tax_rate=0.0, metadata={"pack_id":"small"})
    print("INVOICE:", invoice)
    payment_result = process_payment(invoice_id=invoice["invoice_id"], method="manual_transfer", simulate_status="paid")
    print("PAYMENT RESULT:", payment_result)
    if payment_result.get("success") and payment_result.get("payment"):
        print("VALIDATION:", validate_payment(payment_result["payment"]))
