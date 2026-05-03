from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

CONVERSATION_OUTCOMES: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _safe_bool(value):
    if isinstance(value, bool): return value
    if isinstance(value, str): return _normalize_text(value) in {"true","1","yes","y"}
    if isinstance(value, (int,float)): return value != 0
    return False
def _safe_float(value):
    try: return float(value)
    except: return 0.0
def _generate_outcome_id(): return f"out_{uuid4().hex[:16]}"

def _derive_conversion_status(booking, paid, handoff_success, topup, upgrade_plan):
    if paid: return "paid"
    if booking: return "booked"
    if upgrade_plan: return "upgrade"
    if topup: return "topup"
    if handoff_success: return "handoff"
    return "no_conversion"

def track_outcome(session_id, tenant_id, clinic_id=None, branch_id=None, booking=False, paid=False, revenue=0.0, upgrade_plan=False, topup=False, handoff_success=False, first_booking=False, repeat_booking=False, upsell_success=False, refund_flag=False, affiliate_conversion=False, agent_conversion=False, booking_id=None, invoice_id=None, payment_id=None, source_channel=None, metadata=None):
    booking=_safe_bool(booking); paid=_safe_bool(paid); upgrade_plan=_safe_bool(upgrade_plan); topup=_safe_bool(topup); handoff_success=_safe_bool(handoff_success); first_booking=_safe_bool(first_booking); repeat_booking=_safe_bool(repeat_booking); upsell_success=_safe_bool(upsell_success); refund_flag=_safe_bool(refund_flag); affiliate_conversion=_safe_bool(affiliate_conversion); agent_conversion=_safe_bool(agent_conversion)
    revenue = max(0.0, _safe_float(revenue))
    conversion_status = _derive_conversion_status(booking=booking, paid=paid, handoff_success=handoff_success, topup=topup, upgrade_plan=upgrade_plan)
    record = {"outcome_id":_generate_outcome_id(),"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"booking":booking,"paid":paid,"revenue":round(revenue,2),"upgrade_plan":upgrade_plan,"topup":topup,"handoff_success":handoff_success,"conversion_status":conversion_status,"first_booking":first_booking,"repeat_booking":repeat_booking,"upsell_success":upsell_success,"refund_flag":refund_flag,"affiliate_conversion":affiliate_conversion,"agent_conversion":agent_conversion,"booking_id":booking_id,"invoice_id":invoice_id,"payment_id":payment_id,"source_channel":_normalize_text(source_channel) if source_channel else None,"metadata":metadata or {},"created_at":_now_iso()}
    CONVERSATION_OUTCOMES.append(record)
    return record

def list_outcomes(tenant_id=None, clinic_id=None, branch_id=None, session_id=None, conversion_status=None, paid=None, booking=None, source_channel=None, limit=100):
    results = []
    for item in reversed(CONVERSATION_OUTCOMES):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if branch_id and item.get("branch_id") != branch_id: continue
        if session_id and item.get("session_id") != session_id: continue
        if conversion_status and item.get("conversion_status") != _normalize_text(conversion_status): continue
        if paid is not None and item.get("paid") != paid: continue
        if booking is not None and item.get("booking") != booking: continue
        if source_channel and item.get("source_channel") != _normalize_text(source_channel): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def get_outcome_by_session(session_id):
    for item in CONVERSATION_OUTCOMES:
        if item.get("session_id") == session_id: return item
    return None

def summarize_outcomes(tenant_id=None, clinic_id=None, branch_id=None, source_channel=None):
    items = list_outcomes(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, source_channel=source_channel, limit=100000)
    total_sessions = len(items)
    total_bookings = sum(1 for x in items if x.get("booking"))
    total_paid = sum(1 for x in items if x.get("paid"))
    total_topup = sum(1 for x in items if x.get("topup"))
    total_upgrade = sum(1 for x in items if x.get("upgrade_plan"))
    total_handoff = sum(1 for x in items if x.get("handoff_success"))
    total_revenue = sum(_safe_float(x.get("revenue",0.0)) for x in items)
    conversion_counts = {}
    for item in items:
        key = item.get("conversion_status","unknown")
        conversion_counts[key] = conversion_counts.get(key,0) + 1
    booking_rate = round((total_bookings/total_sessions),4) if total_sessions > 0 else 0.0
    paid_rate = round((total_paid/total_sessions),4) if total_sessions > 0 else 0.0
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"source_channel":source_channel,"total_sessions":total_sessions,"total_bookings":total_bookings,"total_paid":total_paid,"total_topup":total_topup,"total_upgrade":total_upgrade,"total_handoff":total_handoff,"total_revenue":round(total_revenue,2),"booking_rate":booking_rate,"paid_rate":paid_rate,"conversion_counts":conversion_counts,"generated_at":_now_iso()}

def build_learning_label_package(session_id):
    outcome = get_outcome_by_session(session_id)
    if not outcome: return {"session_id":session_id,"exists":False,"label_package":None,"generated_at":_now_iso()}
    label_package = {"is_booking":outcome.get("booking",False),"is_paid":outcome.get("paid",False),"revenue":outcome.get("revenue",0.0),"is_topup":outcome.get("topup",False),"is_upgrade":outcome.get("upgrade_plan",False),"is_handoff_success":outcome.get("handoff_success",False),"conversion_status":outcome.get("conversion_status"),"is_positive_outcome":bool(outcome.get("paid") or outcome.get("booking") or outcome.get("topup") or outcome.get("upgrade_plan")),"is_negative_outcome":bool(not outcome.get("paid") and not outcome.get("booking") and not outcome.get("handoff_success"))}
    return {"session_id":session_id,"exists":True,"label_package":label_package,"generated_at":_now_iso()}

def validate_outcome_record(record):
    errors = []
    for field in ["outcome_id","session_id","tenant_id","booking","paid","revenue","conversion_status","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if _safe_float(record.get("revenue",0.0)) < 0: errors.append("revenue cannot be negative")
    if record.get("conversion_status") not in {"paid","booked","upgrade","topup","handoff","no_conversion"}: errors.append("invalid conversion_status")
    return {"valid": len(errors)==0, "errors": errors}

def validate_learning_label_package(package):
    errors = []
    if "session_id" not in package: errors.append("missing session_id")
    if "exists" not in package: errors.append("missing exists")
    if package.get("exists") and not isinstance(package.get("label_package"), dict): errors.append("label_package must be dict when exists=true")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== OUTCOME TRACKER TEST ===")
    r1 = track_outcome(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, handoff_success=True, first_booking=True, booking_id="bk_001", invoice_id="inv_001", payment_id="pay_001", source_channel="line")
    print("TRACKED:", r1)
    print("VALID:", validate_outcome_record(r1))
    print("LABEL:", build_learning_label_package("s_001"))
    print("SUMMARY:", summarize_outcomes(tenant_id="t_001"))
