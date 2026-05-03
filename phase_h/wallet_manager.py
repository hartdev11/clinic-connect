from __future__ import annotations
from typing import Dict, Any
from datetime import datetime
import uuid

WALLETS: Dict[str, Dict[str, Any]] = {}
TRANSACTIONS = []

def _now():
    return datetime.utcnow().isoformat()

def _generate_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"

def create_wallet(tenant_id):
    if tenant_id in WALLETS: return WALLETS[tenant_id]
    wallet = {"tenant_id": tenant_id, "balance_tokens": 0, "status": "active", "created_at": _now(), "updated_at": _now()}
    WALLETS[tenant_id] = wallet
    return wallet

def get_wallet(tenant_id):
    if tenant_id not in WALLETS: return create_wallet(tenant_id)
    return WALLETS[tenant_id]

def add_tokens(tenant_id, amount, source="topup", reference_id=""):
    wallet = get_wallet(tenant_id)
    wallet["balance_tokens"] += amount
    wallet["updated_at"] = _now()
    TRANSACTIONS.append({"transaction_id": _generate_id("txn"), "tenant_id": tenant_id, "type": "credit", "amount": amount, "source": source, "reference_id": reference_id, "created_at": _now()})
    return wallet

def deduct_tokens(tenant_id, amount, source="usage", reference_id=""):
    wallet = get_wallet(tenant_id)
    if wallet["balance_tokens"] < amount: return {"success": False, "reason": "insufficient_balance", "balance": wallet["balance_tokens"]}
    wallet["balance_tokens"] -= amount
    wallet["updated_at"] = _now()
    TRANSACTIONS.append({"transaction_id": _generate_id("txn"), "tenant_id": tenant_id, "type": "debit", "amount": amount, "source": source, "reference_id": reference_id, "created_at": _now()})
    return {"success": True, "balance": wallet["balance_tokens"]}

def check_balance(tenant_id):
    return get_wallet(tenant_id)["balance_tokens"]

def can_use_service(tenant_id):
    wallet = get_wallet(tenant_id)
    return wallet["balance_tokens"] > 0 and wallet["status"] == "active"

if __name__ == "__main__":
    print("=== WALLET TEST ===")
    tenant = "tenant_001"
    print(create_wallet(tenant))
    print(add_tokens(tenant, 1000))
    print(deduct_tokens(tenant, 200))
    print(check_balance(tenant))
    print(can_use_service(tenant))
