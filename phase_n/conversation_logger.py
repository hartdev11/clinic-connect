from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

CONVERSATION_LOGS: List[Dict[str, Any]] = []

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip()
def _safe_dict(value): return value if isinstance(value, dict) else {}
def _generate_conversation_id(): return f"conv_{uuid4().hex[:16]}"

def log_conversation(session_id, tenant_id, clinic_id, branch_id, channel, external_user_id, user_message, ai_response, intent=None, procedure_recommended=None, cta=None, model_used=None, cost_estimate=None, prompt_version=None, rule_version=None, response_variant_id=None, inventory_snapshot_id=None, message_index=None, metadata=None):
    record = {"conversation_id":_generate_conversation_id(),"session_id":session_id,"tenant_id":tenant_id,"clinic_id":clinic_id,"branch_id":branch_id,"channel":_normalize_text(channel).lower(),"external_user_id":external_user_id,"user_message":_normalize_text(user_message),"ai_response":_normalize_text(ai_response),"intent":_normalize_text(intent).lower() if intent else None,"procedure_recommended":procedure_recommended,"cta":cta,"model_used":model_used,"cost_estimate":float(cost_estimate) if cost_estimate is not None else None,"prompt_version":prompt_version,"rule_version":rule_version,"response_variant_id":response_variant_id,"inventory_snapshot_id":inventory_snapshot_id,"message_index":message_index,"metadata":_safe_dict(metadata),"created_at":_now_iso()}
    CONVERSATION_LOGS.append(record)
    return record

def list_conversations(tenant_id=None, clinic_id=None, branch_id=None, channel=None, session_id=None, intent=None, procedure_recommended=None, model_used=None, limit=100):
    results = []
    for item in reversed(CONVERSATION_LOGS):
        if tenant_id and item.get("tenant_id") != tenant_id: continue
        if clinic_id and item.get("clinic_id") != clinic_id: continue
        if branch_id and item.get("branch_id") != branch_id: continue
        if channel and item.get("channel") != _normalize_text(channel).lower(): continue
        if session_id and item.get("session_id") != session_id: continue
        if intent and item.get("intent") != _normalize_text(intent).lower(): continue
        if procedure_recommended and item.get("procedure_recommended") != procedure_recommended: continue
        if model_used and item.get("model_used") != model_used: continue
        results.append(item)
        if len(results) >= limit: break
    return results

def get_conversation(conversation_id):
    for item in CONVERSATION_LOGS:
        if item.get("conversation_id") == conversation_id: return item
    return None

def get_session_conversations(session_id):
    return [x for x in CONVERSATION_LOGS if x.get("session_id") == session_id]

def summarize_conversations(tenant_id=None, clinic_id=None, channel=None):
    items = list_conversations(tenant_id=tenant_id, clinic_id=clinic_id, channel=channel, limit=100000)
    by_intent = {}; by_procedure = {}; by_cta = {}; by_model = {}
    total_cost_estimate = 0.0
    for item in items:
        intent = item.get("intent") or "unknown"
        procedure = item.get("procedure_recommended") or "unknown"
        cta = item.get("cta") or "none"
        model = item.get("model_used") or "unknown"
        by_intent[intent] = by_intent.get(intent, 0) + 1
        by_procedure[procedure] = by_procedure.get(procedure, 0) + 1
        by_cta[cta] = by_cta.get(cta, 0) + 1
        by_model[model] = by_model.get(model, 0) + 1
        if item.get("cost_estimate") is not None: total_cost_estimate += float(item["cost_estimate"])
    return {"tenant_id":tenant_id,"clinic_id":clinic_id,"channel":channel,"total_conversations":len(items),"by_intent":by_intent,"by_procedure":by_procedure,"by_cta":by_cta,"by_model":by_model,"total_cost_estimate":round(total_cost_estimate,10),"generated_at":_now_iso()}

def validate_conversation_record(record):
    errors = []
    for field in ["conversation_id","session_id","tenant_id","channel","external_user_id","user_message","ai_response","created_at"]:
        if field not in record: errors.append(f"missing {field}")
    if not record.get("user_message"): errors.append("empty user_message")
    if not record.get("ai_response"): errors.append("empty ai_response")
    if record.get("cost_estimate") is not None:
        try:
            if float(record["cost_estimate"]) < 0: errors.append("cost_estimate cannot be negative")
        except: errors.append("invalid cost_estimate")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    print("=== CONVERSATION LOGGER TEST ===")
    r1 = log_conversation(session_id="s_001", tenant_id="t_001", clinic_id="c_001", branch_id="b_001", channel="line", external_user_id="u_ext_001", user_message="botox ราคาเท่าไหร่", ai_response="Botox มีหลายโปรค่ะ", intent="pricing", procedure_recommended="proc_botox", cta="book_now", model_used="gpt-4o-mini", cost_estimate=0.0021, prompt_version="pv_001", rule_version="rv_001", response_variant_id="cta_B", inventory_snapshot_id="inv_001", message_index=1, metadata={"source":"runtime"})
    print("LOG:", r1)
    print("VALID:", validate_conversation_record(r1))
    print("SUMMARY:", summarize_conversations(tenant_id="t_001"))
