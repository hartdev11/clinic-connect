
import json

INPUT_FILE = "dashboard_output.json"

def check_required_fields(d):
    required = ["overview", "trend", "funnel", "top_procedures", "insights", "alerts"]
    return [f"Missing field: {r}" for r in required if r not in d]

def check_overview(d):
    ov = d.get("overview", {})
    errors = []
    if ov.get("total_sessions", 0) <= 0: errors.append("total_sessions = 0")
    if ov.get("total_revenue", 0) <= 0: errors.append("total_revenue = 0")
    return errors

def check_funnel(d):
    f = d.get("funnel", {})
    view = f.get("view", 0)
    click = f.get("click", 0)
    booking = f.get("booking", 0)
    if not (view >= click >= booking):
        return ["Invalid funnel (view >= click >= booking)"]
    return []

def check_insights(d):
    insights = d.get("insights", [])
    if not insights: return ["Insights empty"]
    return []

def check_trend(d):
    trend = d.get("trend", {})
    daily = trend.get("daily", {})
    if not daily: return ["No daily trend data"]
    return []

def check_kpi(d):
    errors = []
    ov = d.get("overview", {})
    ctr = ov.get("ctr", 0)
    conv = ov.get("conversion_rate", 0)
    if ctr < 0.05: errors.append(f"CTR too low: {ctr}")
    if conv < 0.08: errors.append(f"Conversion too low: {conv}")
    return errors

def validate_dashboard(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        d = json.load(f)
    checks = [
        ("Required Fields", check_required_fields),
        ("Overview", check_overview),
        ("Funnel", check_funnel),
        ("Insights", check_insights),
        ("Trend", check_trend),
        ("KPI", check_kpi),
    ]
    all_errors = []
    print("\n🔍 DASHBOARD VALIDATION\n")
    for name, func in checks:
        errors = func(d)
        if errors:
            print(f"❌ {name} FAILED")
            for e in errors: print("  -", e)
            all_errors.extend(errors)
        else:
            print(f"✅ {name} PASSED")
    print("\n========================")
    if all_errors:
        print("❌ FINAL RESULT: FAIL")
    else:
        print("🎉 FINAL RESULT: PASS")
    return all_errors

if __name__ == "__main__":
    validate_dashboard(INPUT_FILE)
