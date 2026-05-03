from __future__ import annotations
from typing import Dict, Any, Optional
from datetime import datetime
import uuid

INVOICES = {}

def _now():
    return datetime.utcnow().isoformat()

def _generate_invoice_id():
    return f"INV_{uuid.uuid4().hex[:10]}"

def _safe_float(v):
    try: return float(v)
    except: return 0.0

def calculate_tax(amount, tax_rate=0.0):
    return round(amount * tax_rate, 2)

def create_invoice(tenant_id, source_type, source_id, base_price, final_price, discount_amount=0.0, tax_rate=0.0, metadata=None):
    metadata = metadata or {}
    tax_amount = calculate_tax(final_price, tax_rate)
    total_amount = round(final_price + tax_amount, 2)
    invoice_id = _generate_invoice_id()
    invoice = {
        "invoice_id": invoice_id,
        "tenant_id": tenant_id,
        "source_type": source_type,
        "source_id": source_id,
        "base_price": _safe_float(base_price),
        "discount_amount": _safe_float(discount_amount),
        "final_price": _safe_float(final_price),
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": total_amount,
        "currency": "THB",
        "status": "pending",
        "metadata": metadata,
        "created_at": _now(),
        "paid_at": None,
    }
    INVOICES[invoice_id] = invoice
    return invoice

def mark_invoice_paid(invoice_id):
    invoice = INVOICES.get(invoice_id)
    if not invoice: return {"success": False, "reason": "invoice_not_found"}
    if invoice["status"] == "paid": return {"success": True, "message": "already_paid"}
    invoice["status"] = "paid"
    invoice["paid_at"] = _now()
    return {"success": True, "invoice": invoice}

def get_invoice(invoice_id):
    return INVOICES.get(invoice_id)

def validate_invoice(invoice):
    errors = []
    required = ["invoice_id","tenant_id","source_type","source_id","base_price","discount_amount","final_price","tax_amount","total_amount","currency","status","created_at"]
    for field in required:
        if field not in invoice: errors.append(f"missing field: {field}")
    if _safe_float(invoice.get("total_amount",0)) < 0: errors.append("total_amount cannot be negative")
    if invoice.get("status") not in {"pending","paid"}: errors.append("invalid status")
    if not invoice.get("tenant_id"): errors.append("missing tenant_id")
    if not invoice.get("source_type"): errors.append("missing source_type")
    expected_total = round(_safe_float(invoice.get("final_price",0)) + _safe_float(invoice.get("tax_amount",0)), 2)
    if round(_safe_float(invoice.get("total_amount",0)), 2) != expected_total: errors.append("total_amount mismatch")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== INVOICE TEST ===")
    invoice = create_invoice(tenant_id="tenant_001", source_type="topup", source_id="topup_123", base_price=500, final_price=400, discount_amount=100, tax_rate=0.07, metadata={"pack_id":"small"})
    print(invoice)
    print(mark_invoice_paid(invoice["invoice_id"]))
    print(validate_invoice(invoice))
