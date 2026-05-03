from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional
from conversion_tracker import summarize_funnel

DEFAULT_FUNNEL_ANALYZER_CONFIG = {
    "high_drop_threshold": 0.70,
    "medium_drop_threshold": 0.40,
    "low_ctr_threshold": 0.10,
    "low_booking_from_click_threshold": 0.15,
    "low_payment_from_booking_threshold": 0.30,
}

def _now_iso(): return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
def _safe_float(v):
    try: return float(v)
    except: return 0.0
def _drop_rate(prev_count, next_count):
    if prev_count <= 0: return 0.0
    return round(max((prev_count - next_count) / prev_count, 0.0), 4)
def _severity_from_drop(drop_rate, config):
    if drop_rate >= config["high_drop_threshold"]: return "high"
    if drop_rate >= config["medium_drop_threshold"]: return "medium"
    return "low"

def analyze_stage_drops(funnel_summary, config=None):
    config = {**DEFAULT_FUNNEL_ANALYZER_CONFIG, **(config or {})}
    view = int(funnel_summary.get("view",0))
    click = int(funnel_summary.get("click",0))
    booking = int(funnel_summary.get("booking",0))
    payment = int(funnel_summary.get("payment",0))
    drop_view_click = _drop_rate(view, click)
    drop_click_booking = _drop_rate(click, booking)
    drop_booking_payment = _drop_rate(booking, payment)
    stages = [
        {"stage":"view_to_click","from_count":view,"to_count":click,"drop_rate":drop_view_click,"severity":_severity_from_drop(drop_view_click,config)},
        {"stage":"click_to_booking","from_count":click,"to_count":booking,"drop_rate":drop_click_booking,"severity":_severity_from_drop(drop_click_booking,config)},
        {"stage":"booking_to_payment","from_count":booking,"to_count":payment,"drop_rate":drop_booking_payment,"severity":_severity_from_drop(drop_booking_payment,config)},
    ]
    biggest_drop = max(stages, key=lambda x: x["drop_rate"]) if stages else None
    return {"stages":stages,"biggest_drop":biggest_drop}

def build_recommendations(funnel_summary, stage_analysis, config=None):
    config = {**DEFAULT_FUNNEL_ANALYZER_CONFIG, **(config or {})}
    recommendations = []
    ctr = _safe_float(funnel_summary.get("click_through_rate",0))
    booking_rate = _safe_float(funnel_summary.get("booking_rate_from_click",0))
    payment_rate = _safe_float(funnel_summary.get("payment_rate_from_booking",0))
    biggest_drop = stage_analysis.get("biggest_drop") or {}
    biggest_stage = biggest_drop.get("stage")
    if ctr < config["low_ctr_threshold"]:
        recommendations.append({"type":"copy_or_cta_optimization","priority":"high","reason":f"CTR is low ({ctr:.4f})","suggestion":"ปรับข้อความ CTA, โปรโมชันหน้าแรก, และตำแหน่งปุ่มให้คนกดมากขึ้น"})
    if booking_rate < config["low_booking_from_click_threshold"]:
        recommendations.append({"type":"booking_flow_optimization","priority":"high","reason":f"booking rate from click is low ({booking_rate:.4f})","suggestion":"ลด friction ในหน้า booking, ลดจำนวนฟิลด์, เพิ่ม social proof, และเพิ่ม urgency offer"})
    if payment_rate < config["low_payment_from_booking_threshold"]:
        recommendations.append({"type":"payment_conversion_optimization","priority":"high","reason":f"payment rate from booking is low ({payment_rate:.4f})","suggestion":"ปรับขั้นตอนปิดการขาย, follow-up อัตโนมัติ, และเสนอส่วนลด/มัดจำเพื่อปิด payment"})
    if biggest_stage == "view_to_click":
        recommendations.append({"type":"top_of_funnel_improvement","priority":"medium","reason":"biggest drop is view to click","suggestion":"เพิ่ม hook, ปรับ creative, และทำแคมเปญเฉพาะกลุ่มให้ข้อความตรง pain point มากขึ้น"})
    if biggest_stage == "click_to_booking":
        recommendations.append({"type":"mid_funnel_improvement","priority":"high","reason":"biggest drop is click to booking","suggestion":"เพิ่ม offer ก่อนจอง, ลดขั้นตอนการจอง, ใส่รีวิว/เคสจริง, และเพิ่ม callback option"})
    if biggest_stage == "booking_to_payment":
        recommendations.append({"type":"bottom_funnel_improvement","priority":"high","reason":"biggest drop is booking to payment","suggestion":"เพิ่ม automation follow-up, ชำระมัดจำง่ายขึ้น, และเสนอโปรโมชั่นปิดการขายระยะสั้น"})
    if not recommendations:
        recommendations.append({"type":"maintain_and_scale","priority":"low","reason":"funnel is within acceptable range","suggestion":"funnel ยังอยู่ในเกณฑ์ดี ให้เน้น scale traffic และทดสอบแคมเปญใหม่เพื่อโตต่อ"})
    return recommendations

def analyze_funnel(tenant_id, channel=None, campaign_id=None, config=None):
    config = {**DEFAULT_FUNNEL_ANALYZER_CONFIG, **(config or {})}
    funnel_summary = summarize_funnel(tenant_id=tenant_id, channel=channel, campaign_id=campaign_id)
    stage_analysis = analyze_stage_drops(funnel_summary=funnel_summary, config=config)
    recommendations = build_recommendations(funnel_summary=funnel_summary, stage_analysis=stage_analysis, config=config)
    biggest_drop = stage_analysis.get("biggest_drop")
    return {"tenant_id":tenant_id,"channel":channel,"campaign_id":campaign_id,"funnel_summary":funnel_summary,"stage_analysis":stage_analysis,"biggest_drop_stage":biggest_drop.get("stage") if biggest_drop else None,"biggest_drop_rate":biggest_drop.get("drop_rate") if biggest_drop else None,"recommendations":recommendations,"generated_at":_now_iso()}

def validate_funnel_analysis(result):
    errors = []
    for field in ["tenant_id","funnel_summary","stage_analysis","recommendations","generated_at"]:
        if field not in result: errors.append(f"missing field: {field}")
    if not isinstance(result.get("funnel_summary",{}), dict): errors.append("funnel_summary must be a dict")
    if not isinstance(result.get("stage_analysis",{}), dict): errors.append("stage_analysis must be a dict")
    if not isinstance(result.get("recommendations",[]), list): errors.append("recommendations must be a list")
    for idx, rec in enumerate(result.get("recommendations",[])):
        if not isinstance(rec, dict): errors.append(f"recommendations[{idx}] must be a dict"); continue
        for field in ["type","priority","reason","suggestion"]:
            if field not in rec: errors.append(f"recommendations[{idx}] missing field: {field}")
    stage_analysis = result.get("stage_analysis",{})
    stages = stage_analysis.get("stages",[])
    if not isinstance(stages, list): errors.append("stage_analysis.stages must be a list")
    else:
        for idx, stage in enumerate(stages):
            if not isinstance(stage, dict): errors.append(f"stage_analysis.stages[{idx}] must be a dict"); continue
            for field in ["stage","from_count","to_count","drop_rate","severity"]:
                if field not in stage: errors.append(f"stage_analysis.stages[{idx}] missing field: {field}")
    return {"valid": len(errors)==0, "errors": errors}

if __name__ == "__main__":
    from conversion_tracker import track_phase_k_view, track_phase_k_click, track_phase_k_booking, track_payment_success
    print("=== FUNNEL ANALYZER TEST ===")
    tenant = "tenant_h5_demo"
    for _ in range(100): track_phase_k_view(tenant_id=tenant, channel="line", campaign_id="cmp_h5")
    for _ in range(28): track_phase_k_click(tenant_id=tenant, channel="line", campaign_id="cmp_h5")
    for i in range(6): track_phase_k_booking(tenant_id=tenant, booking_id=f"booking_h5_{i}", channel="line", campaign_id="cmp_h5", value=2500)
    for i in range(2): track_payment_success(tenant_id=tenant, invoice_id=f"inv_h5_{i}", source_type="subscription", value=2500, channel="line", metadata={"campaign_id":"cmp_h5"})
    result = analyze_funnel(tenant_id=tenant, channel="line", campaign_id="cmp_h5")
    print(result)
    print(validate_funnel_analysis(result))
