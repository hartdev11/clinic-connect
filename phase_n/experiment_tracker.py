from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

EXPERIMENT_LOGS: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip()
def _normalize_text_lower(value): return _normalize_text(value).lower()
def _safe_dict(value): return value if isinstance(value, dict) else {}
def _safe_float(value):
    try: return float(value)
    except: return 0.0
def _safe_bool(value):
    if isinstance(value, bool): return value
    if isinstance(value, str): return _normalize_text_lower(value) in {"true","1","yes","y"}
    if isinstance(value, (int,float)): return value != 0
    return False
def _generate_experiment_log_id(): return f"exp_log_{uuid4().hex[:16]}"

def _derive_result_label(booking, paid, revenue, drop, handoff_success):
    if paid: return "paid"
    if booking: return "booking"
    if revenue > 0: return "revenue"
    if handoff_success: return "handoff"
    if drop: return "drop"
    return "no_result"

def track_experiment(experiment_id, variant_id, experiment_type, session_id, tenant_id, clinic_id=None, branch_id=None, assigned_variant=None, booking=False, paid=False, revenue=0.0, drop=False, handoff_success=False, channel=None, intent=None, procedure_recommended=None, model_used=None, prompt_version=None, metadata=None):
    booking=_safe_bool(booking); paid=_safe_bool(paid); drop=_safe_bool(drop); handoff_success=_safe_bool(handoff_success)
    revenue = max(0.0, _safe_float(revenue))
    result_label = _derive_result_label(booking=booking, paid=paid, revenue=revenue, drop=drop, handoff_success=handoff_success)
    record = {"experiment_log_id":_generate_experiment_log_id(),"experiment_id":_normalize_text(experiment_id),"variant_id":_normalize_text(variant_id),"experiment_type":_normalize_text_lower(experiment_type),"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"assigned_variant":_normalize_text(assigned_variant or variant_id),"booking":booking,"paid":paid,"revenue":round(revenue,2),"drop":drop,"handoff_success":handoff_success,"result":result_label,"channel":_normalize_text_lower(channel) if channel else None,"intent":_normalize_text_lower(intent) if intent else None,"procedure_recommended":procedure_recommended,"model_used":_normalize_text(model_used),"prompt_version":prompt_version,"assigned_at":_now_iso(),"metadata":_safe_dict(metadata)}
    EXPERIMENT_LOGS.append(record)
    return record

def list_experiment_logs(tenant_id=None, clinic_id=None, branch_id=None, experiment_id=None, experiment_type=None, variant_id=None, session_id=None, result=None, channel=None, limit=100):
    results = []
    for item in reversed(EXPERIMENT_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if branch_id and item.get("branch_id") != branch_id: continue
        if experiment_id and item.get("experiment_id") != _normalize_text(experiment_id): continue
        if experiment_type and item.get("experiment_type") != _normalize_text_lower(experiment_type): continue
        if variant_id and item.get("variant_id") != _normalize_text(variant_id): continue
        if session_id and item.get("session_id") != session_id: continue
        if result and item.get("result") != _normalize_text_lower(result): continue
        if channel and item.get("channel") != _normalize_text_lower(channel): continue
        results.append(item)
        if len(results) >= limit: break
    return results

def get_experiment_results(experiment_id):
    return [x for x in EXPERIMENT_LOGS if x.get("experiment_id") == _normalize_text(experiment_id)]

def summarize_experiment(experiment_id):
    items = get_experiment_results(experiment_id)
    by_variant = {}
    for item in items:
        variant = item.get("variant_id","unknown")
        if variant not in by_variant:
            by_variant[variant] = {"sessions":0,"booking_count":0,"paid_count":0,"drop_count":0,"handoff_count":0,"total_revenue":0.0}
        by_variant[variant]["sessions"] += 1
        by_variant[variant]["booking_count"] += 1 if item.get("booking") else 0
        by_variant[variant]["paid_count"] += 1 if item.get("paid") else 0
        by_variant[variant]["drop_count"] += 1 if item.get("drop") else 0
        by_variant[variant]["handoff_count"] += 1 if item.get("handoff_success") else 0
        by_variant[variant]["total_revenue"] += _safe_float(item.get("revenue",0.0))
    winner_variant = None; winner_score = -1.0
    for variant, stats in by_variant.items():
        sessions = stats["sessions"]
        booking_rate = (stats["booking_count"]/sessions) if sessions > 0 else 0.0
        paid_rate = (stats["paid_count"]/sessions) if sessions > 0 else 0.0
        avg_revenue = (stats["total_revenue"]/sessions) if sessions > 0 else 0.0
        stats["booking_rate"] = round(booking_rate,4); stats["paid_rate"] = round(paid_rate,4); stats["avg_revenue"] = round(avg_revenue,2); stats["total_revenue"] = round(stats["total_revenue"],2)
        score = (paid_rate*1000) + (booking_rate*100) + avg_revenue
        if score > winner_score: winner_score = score; winner_variant = variant
    return {"experiment_id":_normalize_text(experiment_id),"variant_summary":by_variant,"winner_variant":winner_variant,"winner_score":round(winner_score,4) if winner_variant else None,"generated_at":_now_iso()}

def summarize_experiments_by_type(tenant_id=None, experiment_type=None):
    items = list_experiment_logs(tenant_id=tenant_id, experiment_type=experiment_type, limit=100000)
    by_type = {}; by_result = {}
    for item in items:
        exp_type = item.get("experiment_type") or "unknown"
        result = item.get("result") or "unknown"
        by_type[exp_type] = by_type.get(exp_type,0) + 1
        by_result[result] = by_result.get(result,0) + 1
    return {"tenant_id":tenant_id,"experiment_type_filter":experiment_type,"total_logs":len(items),"by_type":by_type,"by_result":by_result,"generated_at":_now_iso()}

def validate_experiment_record(record):
    errors = []
    for field in ["experiment_log_id","experiment_id","variant_id","experiment_type","session_id","tenant_id","assigned_variant","result","assigned_at"]:
        if field not in record: errors.append(f"missing {field}")
    if not record.get("experiment_type"): errors.append("empty experiment_type")
    if not record.get("variant_id"): errors.append("empty variant_id")
    if _safe_float(record.get("revenue",0.0)) < 0: errors.append("revenue cannot be negative")
    if record.get("result") not in {"paid","booking","revenue","handoff","drop","no_result"}: errors.append("invalid result")
    return {"valid": len(errors)==0, "errors": errors}

def validate_experiment_summary(summary):
    errors = []
    for field in ["experiment_id","variant_summary","winner_variant","generated_at"]:
        if field not in summary: errors.append(f"missing {field}")
    if not isinstance(summary.get("variant_summary",{}), dict): errors.append("variant_summary must be a dict")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== EXPERIMENT TRACKER TEST ===")
    r1 = track_experiment(experiment_id="exp_cta_001", variant_id="cta_A", experiment_type="cta", session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=False, revenue=0, channel="line", intent="pricing", procedure_recommended="proc_botox", model_used="gpt-4o-mini", prompt_version="pv_001")
    r2 = track_experiment(experiment_id="exp_cta_001", variant_id="cta_B", experiment_type="cta", session_id="s_002", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", booking=True, paid=True, revenue=12000, channel="line", intent="pricing")
    summary = summarize_experiment("exp_cta_001")
    print("SUMMARY:", summary)
    print("SUMMARY VALID:", validate_experiment_summary(summary))
