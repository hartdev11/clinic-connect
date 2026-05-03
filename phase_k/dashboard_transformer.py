
import json
from typing import Any, Dict, List

def build_overview_cards(d):
    ov = d.get("overview", {})
    return [
        {"key":"total_users","label":"Total Users","value":ov.get("total_users",0),"type":"number"},
        {"key":"total_sessions","label":"Total Sessions","value":ov.get("total_sessions",0),"type":"number"},
        {"key":"total_leads","label":"Total Leads","value":ov.get("total_leads",0),"type":"number"},
        {"key":"total_bookings","label":"Total Bookings","value":ov.get("total_bookings",0),"type":"number"},
        {"key":"total_revenue","label":"Total Revenue","value":ov.get("total_revenue",0),"type":"currency"},
        {"key":"conversion_rate","label":"Conversion Rate","value":ov.get("conversion_rate",0),"type":"percent"},
        {"key":"ctr","label":"CTR","value":ov.get("ctr",0),"type":"percent"},
    ]

def build_funnel_widget(d):
    f = d.get("funnel", {})
    return {"type":"funnel","title":"Sales Funnel","items":[{"label":"View","value":f.get("view",0)},{"label":"Click","value":f.get("click",0)},{"label":"Booking","value":f.get("booking",0)}]}

def build_trend_widget(d):
    trend = d.get("trend", {}).get("daily", [])
    return {"type":"line_chart","title":"Daily Trend","series":{"revenue":[{"x":x.get("date",""),"y":x.get("revenue",0)} for x in trend],"bookings":[{"x":x.get("date",""),"y":x.get("bookings",0)} for x in trend],"sessions":[{"x":x.get("date",""),"y":x.get("sessions",0)} for x in trend]}}

def build_top_procedures_widget(d):
    return {"type":"table","title":"Top Procedures","columns":["procedure_name","views","bookings","revenue","conversion_rate"],"rows":d.get("top_procedures",[])}

def build_top_channels_widget(d):
    return {"type":"table","title":"Top Channels","columns":["channel","sessions","bookings","revenue","conversion_rate"],"rows":d.get("top_channels",[])}

def build_recent_bookings_widget(d):
    return {"type":"table","title":"Recent Bookings","columns":["booking_id","customer_id","procedure_name","branch_id","status","revenue","timestamp"],"rows":d.get("bookings",{}).get("recent",[])}

def build_insight_feed(d):
    return {"type":"feed","title":"Insights & Alerts","insights":d.get("insights",[]),"alerts":d.get("alerts",[])}

def build_affiliate_widget(d):
    aff = d.get("affiliate", {})
    return {"type":"affiliate_panel","title":"Affiliate Performance","enabled":aff.get("enabled",False),"summary":{"total_clicks":aff.get("total_clicks",0),"total_leads":aff.get("total_leads",0),"total_bookings":aff.get("total_bookings",0),"total_revenue":aff.get("total_revenue",0),"total_commission":aff.get("total_commission",0)},"top_links":aff.get("top_links",[])}

def build_agent_widget(d):
    agent = d.get("agent", {})
    return {"type":"agent_panel","title":"Sales Agent Performance","enabled":agent.get("enabled",False),"summary":{"total_leads":agent.get("total_leads",0),"total_bookings":agent.get("total_bookings",0),"close_rate":agent.get("close_rate",0),"total_revenue":agent.get("total_revenue",0),"total_commission":agent.get("total_commission",0)},"top_agents":agent.get("top_agents",[])}

def build_branch_widget(d):
    bp = d.get("branch_performance", {})
    return {"type":"branch_panel","title":"Branch Performance","enabled":bp.get("enabled",False),"branches":bp.get("branches",[])}

def build_white_label_widget(d):
    wl = d.get("white_label", {})
    return {"type":"white_label_panel","title":"White Label Context","enabled":wl.get("enabled",False),"brand_name":wl.get("brand_name",""),"custom_domain":wl.get("custom_domain",""),"primary_color":wl.get("primary_color",""),"logo_url":wl.get("logo_url","")}

def transform_dashboard(dashboard):
    return {"meta":dashboard.get("meta",{}),"widgets":[{"type":"cards","title":"Overview","items":build_overview_cards(dashboard)},build_funnel_widget(dashboard),build_trend_widget(dashboard),build_top_procedures_widget(dashboard),build_top_channels_widget(dashboard),build_recent_bookings_widget(dashboard),build_affiliate_widget(dashboard),build_agent_widget(dashboard),build_branch_widget(dashboard),build_white_label_widget(dashboard),build_insight_feed(dashboard)]}

def main():
    print("🔄 Running Dashboard Transformer...\n")
    with open("sample_dashboard.json", "r", encoding="utf-8") as f:
        dashboard = json.load(f)
    transformed = transform_dashboard(dashboard)
    with open("dashboard_ui_ready.json", "w", encoding="utf-8") as f:
        json.dump(transformed, f, ensure_ascii=False, indent=2)
    print("✅ Transformed dashboard saved to dashboard_ui_ready.json")

if __name__ == "__main__":
    main()
