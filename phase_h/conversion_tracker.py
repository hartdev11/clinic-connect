from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

CONVERSION_EVENTS: List[Dict[str, Any]] = []

FUNNEL_EVENT_TYPES = {"view","click","booking","payment","subscription_purchase","topup_purchase"}
ALLOWED_OBJECT_TYPES = {"campaign","promotion","booking","subscription","topup","page","channel","unknown"}

def _now(): return datetime.utcnow()
def _now_iso(): return _now().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _generate_event_id(): return f"conv_{uuid4().hex[:16]}"

def track_conversion_event(tenant_id, event_type, object_type="unknown", object_id="", channel="unknown", campaign_id="", promotion_id="", value=0.0, metadata=None):
    if not tenant_id: raise ValueError("tenant_id is required")
    if event_type not in FUNNEL_EVENT_TYPES: raise ValueError(f"invalid event_type: {event_type}")
    if object_type not in ALLOWED_OBJECT_TYPES: object_type = "unknown"
    event = {"event_id":_generate_event_id(),"tenant_id":tenant_id,"event_type":event_type,"object_type":object_type,"object_id":object_id,"channel":channel,"campaign_id":campaign_id,"promotion_id":promotion_id,"value":round(_safe_float(value),2),"metadata":metadata or {},"created_at":_now_iso()}
    CONVERSION_EVENTS.append(event)
    return event

def track_phase_k_view(tenant_id, channel="unknown", campaign_id="", metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="view", object_type="page", channel=channel, campaign_id=campaign_id, metadata=metadata)

def track_phase_k_click(tenant_id, channel="unknown", campaign_id="", promotion_id="", metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="click", object_type="campaign", channel=channel, campaign_id=campaign_id, promotion_id=promotion_id, metadata=metadata)

def track_phase_k_booking(tenant_id, booking_id, channel="unknown", campaign_id="", value=0.0, metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="booking", object_type="booking", object_id=booking_id, channel=channel, campaign_id=campaign_id, value=value, metadata=metadata)

def track_subscription_purchase(tenant_id, subscription_id, value, promotion_id="", metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="subscription_purchase", object_type="subscription", object_id=subscription_id, promotion_id=promotion_id, value=value, metadata=metadata)

def track_topup_purchase(tenant_id, topup_order_id, value, promotion_id="", metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="topup_purchase", object_type="topup", object_id=topup_order_id, promotion_id=promotion_id, value=value, metadata=metadata)

def track_payment_success(tenant_id, invoice_id, source_type, value, channel="unknown", metadata=None):
    return track_conversion_event(tenant_id=tenant_id, event_type="payment", object_type=source_type if source_type in ALLOWED_OBJECT_TYPES else "unknown", object_id=invoice_id, channel=channel, value=value, metadata=metadata)

def get_conversion_events(tenant_id=None, channel=None, campaign_id=None):
    results = CONVERSION_EVENTS
    if tenant_id: results = [e for e in results if e.get("tenant_id") == tenant_id]
    if channel: results = [e for e in results if e.get("channel") == channel]
    if campaign_id: results = [e for e in results if e.get("campaign_id") == campaign_id]
    return results

def summarize_funnel(tenant_id, channel=None, campaign_id=None):
    events = get_conversion_events(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    summary = {"tenant_id":tenant_id,"channel":channel,"campaign_id":campaign_id,"view":0,"click":0,"booking":0,"payment":0,"subscription_purchase":0,"topup_purchase":0,"revenue":0.0,"generated_at":_now_iso()}
    for e in events:
        event_type = e.get("event_type")
        if event_type in summary: summary[event_type] += 1
        if event_type in {"payment","subscription_purchase","topup_purchase"}: summary["revenue"] += _safe_float(e.get("value",0))
    summary["revenue"] = round(summary["revenue"], 2)
    view = summary["view"]; click = summary["click"]; booking = summary["booking"]; payment = summary["payment"]
    summary["click_through_rate"] = round((click/view),4) if view > 0 else 0.0
    summary["booking_rate_from_click"] = round((booking/click),4) if click > 0 else 0.0
    summary["payment_rate_from_booking"] = round((payment/booking),4) if booking > 0 else 0.0
    summary["overall_conversion_rate"] = round((payment/view),4) if view > 0 else 0.0
    return summary

def validate_conversion_event(event):
    errors = []
    for field in ["event_id","tenant_id","event_type","object_type","channel","value","metadata","created_at"]:
        if field not in event: errors.append(f"missing field: {field}")
    if event.get("event_type") not in FUNNEL_EVENT_TYPES: errors.append("invalid event_type")
    if event.get("object_type") not in ALLOWED_OBJECT_TYPES: errors.append("invalid object_type")
    if not isinstance(event.get("metadata",{}), dict): errors.append("metadata must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

def validate_funnel_summary(summary):
    errors = []
    required_fields = ["tenant_id","view","click","booking","payment","subscription_purchase","topup_purchase","revenue","click_through_rate","booking_rate_from_click","payment_rate_from_booking","overall_conversion_rate","generated_at"]
    for field in required_fields:
        if field not in summary: errors.append(f"missing field: {field}")
    for field in ["view","click","booking","payment","subscription_purchase","topup_purchase"]:
        if int(summary.get(field,0)) < 0: errors.append(f"{field} cannot be negative")
    for field in ["click_through_rate","booking_rate_from_click","payment_rate_from_booking","overall_conversion_rate"]:
        if _safe_float(summary.get(field,0)) < 0: errors.append(f"{field} cannot be negative")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== CONVERSION TRACKER TEST ===")
    tenant = "tenant_h4_demo"
    track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_001")
    track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_001")
    track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_001", promotion_id="promo_001")
    track_phase_k_booking(tenant_id=tenant, booking_id="booking_001", channel="line", campaign_id="cmp_001", value=2500)
    track_subscription_purchase(tenant_id=tenant, subscription_id="sub_001", value=9900, promotion_id="promo_sub_001")
    track_topup_purchase(tenant_id=tenant, topup_order_id="topup_001", value=500, promotion_id="promo_topup_001")
    track_payment_success(tenant_id=tenant, invoice_id="inv_001", source_type="subscription", value=9900, channel="line")
    events = get_conversion_events(tenant_id=tenant)
    print(events[-3:])
    summary = summarize_funnel(tenant_id=tenant, channel="line", campaign_id="cmp_001")
    print(summary)
    print(validate_conversion_event(events[0]))
    print(validate_funnel_summary(summary))
