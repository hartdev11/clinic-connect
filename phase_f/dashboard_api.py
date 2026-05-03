
import json
from datetime import datetime

def load_json(file):
    with open(file, "r", encoding="utf-8") as f:
        return json.load(f)

def safe_get(d, key, default=0):
    return d.get(key, default) if d else default

def build_dashboard():
    metrics = load_json("metrics_output.json")
    analytics = load_json("analytics_output.json")
    insights = load_json("insight_output.json")
    schema = load_json("dashboard_schema_v2.json")

    summary = metrics.get("summary", {})
    business = analytics.get("business_metrics", {})

    schema["meta"]["last_updated"] = datetime.utcnow().isoformat()

    schema["overview"] = {
        "total_users": safe_get(summary, "total_users"),
        "total_sessions": safe_get(summary, "total_sessions"),
        "conversion_rate": safe_get(summary, "conversion_rate"),
        "ctr": safe_get(summary, "ctr"),
        "total_revenue": safe_get(summary, "total_revenue"),
        "revenue_per_user": safe_get(business, "revenue_per_user"),
        "revenue_per_session": safe_get(business, "revenue_per_session")
    }

    schema["trend"]["daily"] = analytics.get("daily_trend", {})
    schema["trend"]["comparison"] = analytics.get("comparison", {})

    funnel_drop = analytics.get("funnel_dropoff", {})
    schema["funnel"] = {
        "view": safe_get(summary, "views"),
        "click": safe_get(summary, "clicks"),
        "booking": safe_get(summary, "bookings"),
        "dropoff": {
            "view_to_click": funnel_drop.get("view_to_click_drop", 0),
            "click_to_booking": funnel_drop.get("click_to_booking_drop", 0)
        }
    }

    schema["top_procedures"] = analytics.get("top_procedures_enhanced", [])

    schema["revenue_breakdown"] = {
        "by_procedure": metrics.get("revenue_by_procedure", {}),
        "by_channel": metrics.get("events_by_channel", {}),
        "by_branch": metrics.get("events_by_branch", {})
    }

    schema["channels"] = [
        {"channel": k, "events": v}
        for k, v in metrics.get("events_by_channel", {}).items()
    ]

    schema["insights"] = insights.get("insights", ["No insights available"])
    schema["alerts"] = insights.get("alerts", [])

    schema["data_trust"] = {
        "last_updated": datetime.utcnow().isoformat(),
        "event_count": safe_get(summary, "total_events"),
        "sample_size": safe_get(summary, "total_sessions")
    }

    schema["role_specific"]["clinic_owner"] = {
        "leads": safe_get(summary, "total_sessions"),
        "conversion": safe_get(summary, "conversion_rate"),
        "revenue": safe_get(summary, "total_revenue")
    }

    schema["role_specific"]["affiliate"] = {
        "clicks": safe_get(summary, "clicks"),
        "bookings": safe_get(summary, "bookings"),
        "commission": round(safe_get(summary, "total_revenue") * 0.1, 2)
    }

    return schema

def main():
    print("🚀 Building Dashboard...\n")
    dashboard = build_dashboard()
    with open("dashboard_output.json", "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2, ensure_ascii=False)
    print("✅ dashboard_output.json generated")
    print(f"Revenue: {dashboard['overview']['total_revenue']}")
    print(f"CTR: {dashboard['overview']['ctr']}")
    print(f"Conversion: {dashboard['overview']['conversion_rate']}")

if __name__ == "__main__":
    main()
