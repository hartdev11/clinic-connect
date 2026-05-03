from __future__ import annotations
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from dashboard_repository import DashboardFilters, DashboardRepository, get_dashboard_repository

def _utc_now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _normalize_filters(filters):
    if filters is None: return DashboardFilters()
    if isinstance(filters, DashboardFilters): return filters
    if isinstance(filters, dict):
        return DashboardFilters(tenant_id=filters.get("tenant_id"),clinic_id=filters.get("clinic_id"),branch_id=filters.get("branch_id"),affiliate_id=filters.get("affiliate_id"),agent_id=filters.get("agent_id"),date_from=filters.get("date_from"),date_to=filters.get("date_to"))
    raise TypeError("filters must be DashboardFilters, dict, or None")

def _build_meta(role, filters, partial_data=False, data_quality_flags=None):
    return {"mode":"prod","data_source":"firebase","role":role,"generated_at":_utc_now_iso(),"filters":asdict(filters),"partial_data":partial_data,"data_quality_flags":data_quality_flags or []}

def _default_payload(role, filters):
    return {"meta":_build_meta(role=role,filters=filters),"overview":{},"funnel":{},"trend":[],"top_procedures":[],"top_channels":[],"bookings":{"recent":[],"summary":{}},"customers":{},"affiliate":{},"agent":{},"branch_performance":[],"white_label":{},"insights":[],"alerts":[]}

def _merge_flags(*flag_groups):
    merged,seen=[],set()
    for group in flag_groups:
        if not group: continue
        for flag in group:
            if flag and flag not in seen: seen.add(flag); merged.append(flag)
    return merged

def _build_white_label(filters):
    return {"enabled":False,"tenant_id":filters.tenant_id,"clinic_id":filters.clinic_id,"branch_id":filters.branch_id}

def _build_alerts(overview, funnel, bookings_summary, extra_flags=None):
    alerts=[]
    if not overview:
        alerts.append({"type":"data_notice","level":"warning","message":"overview data unavailable"}); return alerts
    if overview.get("total_sessions",0)==0: alerts.append({"type":"traffic_alert","level":"warning","message":"no sessions found for selected period"})
    if overview.get("total_bookings",0)==0: alerts.append({"type":"booking_alert","level":"warning","message":"no bookings found for selected period"})
    if funnel.get("view",0)>0 and funnel.get("click",0)==0: alerts.append({"type":"funnel_alert","level":"warning","message":"views exist but clicks are zero"})
    if bookings_summary.get("cancelled",0)>bookings_summary.get("completed",0): alerts.append({"type":"operations_alert","level":"warning","message":"cancelled bookings exceed completed bookings"})
    for flag in (extra_flags or []): alerts.append({"type":"data_quality","level":"info","message":flag})
    return alerts

def _build_insights(overview, top_channels, top_procedures, trend):
    insights=[]
    insights.append({"type":"overview_summary","message":f"sessions={overview.get('total_sessions',0)}, bookings={overview.get('total_bookings',0)}, revenue={overview.get('total_revenue',0)}, conversion_rate={overview.get('conversion_rate',0)}"})
    if top_channels: best=top_channels[0]; insights.append({"type":"top_channel","message":f"top channel is {best.get('channel')} with revenue={best.get('revenue',0)}"})
    if top_procedures: best=top_procedures[0]; insights.append({"type":"top_procedure","message":f"top procedure is {best.get('procedure_name')} with revenue={best.get('revenue',0)}"})
    if len(trend)>=2:
        if trend[-1].get("revenue",0)>trend[-2].get("revenue",0): insights.append({"type":"trend_growth","message":"daily revenue increased versus previous day"})
        elif trend[-1].get("revenue",0)<trend[-2].get("revenue",0): insights.append({"type":"trend_decline","message":"daily revenue decreased versus previous day"})
    if not insights: insights.append({"type":"data_notice","message":"insufficient data for insights"})
    return insights

def _compose_payload(role, repo, filters):
    payload=_default_payload(role=role,filters=filters)
    overview=repo.get_overview_metrics(filters)
    funnel=repo.get_funnel_metrics(filters)
    trend=repo.get_daily_trend(filters)
    top_procedures=repo.get_top_procedures(filters)
    top_channels=repo.get_top_channels(filters)
    recent_bookings=repo.get_recent_bookings(filters)
    booking_summary=repo.get_booking_status_summary(filters)
    customers=repo.get_customer_summary(filters)
    affiliate=repo.get_affiliate_summary(filters)
    agent=repo.get_agent_summary(filters)
    branch_performance=repo.get_branch_performance(filters)
    all_flags=_merge_flags(overview.get("data_quality_flags",[]),affiliate.get("data_quality_flags",[]),agent.get("data_quality_flags",[]))
    clean_overview={k:v for k,v in overview.items() if k!="data_quality_flags"}
    payload["meta"]=_build_meta(role=role,filters=filters,data_quality_flags=all_flags)
    payload["overview"]=clean_overview
    payload["funnel"]=funnel
    payload["trend"]=trend
    payload["top_procedures"]=top_procedures
    payload["top_channels"]=top_channels
    payload["bookings"]={"recent":recent_bookings,"summary":booking_summary}
    payload["customers"]=customers
    payload["affiliate"]={k:v for k,v in affiliate.items() if k!="data_quality_flags"}
    payload["agent"]={k:v for k,v in agent.items() if k!="data_quality_flags"}
    payload["branch_performance"]=branch_performance
    payload["white_label"]=_build_white_label(filters)
    payload["insights"]=_build_insights(clean_overview,top_channels,top_procedures,trend)
    payload["alerts"]=_build_alerts(clean_overview,funnel,booking_summary,all_flags)
    return payload

def build_owner_dashboard_data(filters=None, repo=None):
    f=_normalize_filters(filters); r=repo or get_dashboard_repository()
    return _compose_payload("owner",r,f)

def build_clinic_dashboard_data(filters=None, repo=None):
    f=_normalize_filters(filters)
    f=DashboardFilters(tenant_id=f.tenant_id,clinic_id=f.clinic_id,branch_id=f.branch_id,date_from=f.date_from,date_to=f.date_to)
    r=repo or get_dashboard_repository(); return _compose_payload("clinic",r,f)

def build_branch_dashboard_data(filters=None, repo=None):
    f=_normalize_filters(filters)
    f=DashboardFilters(tenant_id=f.tenant_id,clinic_id=f.clinic_id,branch_id=f.branch_id,date_from=f.date_from,date_to=f.date_to)
    r=repo or get_dashboard_repository(); return _compose_payload("branch",r,f)

def build_affiliate_dashboard_data(filters=None, repo=None):
    f=_normalize_filters(filters)
    f=DashboardFilters(tenant_id=f.tenant_id,clinic_id=f.clinic_id,branch_id=f.branch_id,affiliate_id=f.affiliate_id,date_from=f.date_from,date_to=f.date_to)
    r=repo or get_dashboard_repository(); return _compose_payload("affiliate",r,f)

def build_agent_dashboard_data(filters=None, repo=None):
    f=_normalize_filters(filters)
    f=DashboardFilters(tenant_id=f.tenant_id,clinic_id=f.clinic_id,branch_id=f.branch_id,agent_id=f.agent_id,date_from=f.date_from,date_to=f.date_to)
    r=repo or get_dashboard_repository(); return _compose_payload("agent",r,f)

if __name__ == "__main__":
    print("=== DASHBOARD QUERY SERVICE TEST ===\n")
    try:
        filters=DashboardFilters()
        result=build_owner_dashboard_data(filters)
        print("META:",result.get("meta"))
        print("OVERVIEW:",result.get("overview"))
        print("FUNNEL:",result.get("funnel"))
        print(f"INSIGHTS: {len(result.get('insights',[]))} items")
        print(f"ALERTS: {len(result.get('alerts',[]))} items")
        print("\nOK: dashboard_query_service working")
    except Exception as e:
        import traceback; print(f"ERROR: {e}"); traceback.print_exc()
