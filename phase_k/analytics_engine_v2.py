
import json

INPUT_FILE = "metrics_output.json"
OUTPUT_FILE = "analytics_output.json"

def load_metrics():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def safe_div(a, b):
    return a / b if b else 0

def build_comparison(metrics):
    overview = metrics.get("overview", {})
    trend = metrics.get("trend", {}).get("daily", [])
    current_revenue = overview.get("total_revenue", 0)
    current_conversion = overview.get("conversion_rate", 0)
    if len(trend) >= 2:
        previous_period_revenue = sum(x.get("revenue", 0) for x in trend[:-1])
        previous_sessions = sum(x.get("sessions", 0) for x in trend[:-1])
        previous_bookings = sum(x.get("bookings", 0) for x in trend[:-1])
        previous_conversion = safe_div(previous_bookings, previous_sessions)
    else:
        previous_period_revenue = 0
        previous_conversion = 0
    return {
        "previous_period_revenue": round(previous_period_revenue, 2),
        "previous_period_conversion": round(previous_conversion, 4),
        "revenue_growth_rate": round(safe_div(current_revenue - previous_period_revenue, previous_period_revenue), 4) if previous_period_revenue else 0,
        "conversion_growth_rate": round(safe_div(current_conversion - previous_conversion, previous_conversion), 4) if previous_conversion else 0,
    }

def build_business_metrics(metrics):
    overview = metrics.get("overview", {})
    total_users = overview.get("total_users", 0)
    total_sessions = overview.get("total_sessions", 0)
    total_bookings = overview.get("total_bookings", 0)
    total_revenue = overview.get("total_revenue", 0)
    return {
        "revenue_per_user": round(safe_div(total_revenue, total_users), 2),
        "revenue_per_session": round(safe_div(total_revenue, total_sessions), 2),
        "booking_rate_per_user": round(safe_div(total_bookings, total_users), 4),
        "booking_rate_per_session": round(safe_div(total_bookings, total_sessions), 4),
    }

def build_best_worst(metrics):
    top_procedures = metrics.get("top_procedures", [])
    top_channels = metrics.get("top_channels", [])
    branches = metrics.get("branch_performance", {}).get("branches", [])
    agents = metrics.get("agent", {}).get("top_agents", [])
    return {
        "best_procedure": top_procedures[0] if top_procedures else {},
        "worst_procedure": top_procedures[-1] if top_procedures else {},
        "best_channel": sorted(top_channels, key=lambda x: x.get("revenue",0), reverse=True)[0] if top_channels else {},
        "worst_channel": sorted(top_channels, key=lambda x: x.get("revenue",0))[0] if top_channels else {},
        "best_branch": sorted(branches, key=lambda x: x.get("revenue",0), reverse=True)[0] if branches else {},
        "worst_branch": sorted(branches, key=lambda x: x.get("revenue",0))[0] if branches else {},
        "best_agent": sorted(agents, key=lambda x: x.get("revenue",0), reverse=True)[0] if agents else {},
    }

def build_role_analytics(metrics):
    affiliate = metrics.get("affiliate", {})
    agent = metrics.get("agent", {})
    branch_performance = metrics.get("branch_performance", {}).get("branches", [])
    overview = metrics.get("overview", {})
    return {
        "owner": {"total_revenue": overview.get("total_revenue",0),"total_affiliate_revenue": affiliate.get("total_revenue",0),"total_affiliate_commission": affiliate.get("total_commission",0),"total_agent_revenue": agent.get("total_revenue",0),"total_agent_commission": agent.get("total_commission",0),"branch_count": len(branch_performance)},
        "clinic": {"revenue": overview.get("total_revenue",0),"bookings": overview.get("total_bookings",0),"conversion_rate": overview.get("conversion_rate",0),"top_procedures": metrics.get("top_procedures",[])[:5]},
        "affiliate": {"clicks": affiliate.get("total_clicks",0),"leads": affiliate.get("total_leads",0),"bookings": affiliate.get("total_bookings",0),"revenue": affiliate.get("total_revenue",0),"commission": affiliate.get("total_commission",0),"top_links": affiliate.get("top_links",[])[:5]},
        "agent": {"leads": agent.get("total_leads",0),"bookings": agent.get("total_bookings",0),"close_rate": agent.get("close_rate",0),"revenue": agent.get("total_revenue",0),"commission": agent.get("total_commission",0),"top_agents": agent.get("top_agents",[])[:5]},
        "branch": {"branches": branch_performance[:10]},
    }

def build_top_procedures_enhanced(metrics):
    procedures = metrics.get("top_procedures", [])
    enhanced = []
    for p in procedures:
        views = p.get("views", 0)
        bookings = p.get("bookings", 0)
        revenue = p.get("revenue", 0)
        enhanced.append({**p, "revenue_per_view": round(safe_div(revenue, views), 2), "revenue_per_booking": round(safe_div(revenue, bookings), 2)})
    return enhanced

def main():
    print("📈 Running Analytics Engine v2...\n")
    metrics = load_metrics()
    analytics = {
        "comparison": build_comparison(metrics),
        "business_metrics": build_business_metrics(metrics),
        "best_worst": build_best_worst(metrics),
        "role_analytics": build_role_analytics(metrics),
        "daily_trend": metrics.get("trend", {}).get("daily", []),
        "top_procedures_enhanced": build_top_procedures_enhanced(metrics),
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(analytics, f, ensure_ascii=False, indent=2)
    print("✅ Analytics generated: analytics_output.json")
    print("\n📊 BUSINESS METRICS")
    for k, v in analytics["business_metrics"].items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    main()
