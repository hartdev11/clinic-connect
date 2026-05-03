
import json, sys

INPUT_FILE = "sample_dashboard.json"

def load_dashboard(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def ok(msg): print("OK: " + msg)
def fail(errors, msg): errors.append(msg); print("FAIL: " + msg)

def validate_meta(d, errors):
    meta = d.get("meta", {})
    missing = [x for x in ["dashboard_version","generated_at","role"] if not meta.get(x)]
    if missing: fail(errors, f"meta_missing:{missing}")
    else: ok("meta valid")

def validate_overview(d, errors):
    ov = d.get("overview")
    if not isinstance(ov, dict): fail(errors, "overview_missing"); return
    required = ["total_users","total_sessions","total_leads","total_bookings","total_revenue","conversion_rate","ctr"]
    missing = [x for x in required if x not in ov]
    if missing: fail(errors, f"overview_missing_fields:{missing}")
    else: ok("overview valid")

def validate_funnel(d, errors):
    f = d.get("funnel")
    if not isinstance(f, dict): fail(errors, "funnel_missing"); return
    v, c, b = f.get("view",0), f.get("click",0), f.get("booking",0)
    if not (v >= c >= b): fail(errors, f"invalid_funnel:view={v},click={c},booking={b}")
    else: ok("funnel valid")

def validate_kpi(d, errors):
    ov = d.get("overview", {})
    ctr = ov.get("ctr", 0)
    conv = ov.get("conversion_rate", 0)
    rev = ov.get("total_revenue", 0)
    if ctr < 0.05 or ctr > 0.20: fail(errors, f"ctr_out_of_range:{ctr}")
    else: ok("ctr in range")
    if conv < 0.05 or conv > 0.25: fail(errors, f"conversion_out_of_range:{conv}")
    else: ok("conversion in range")
    if rev <= 0: fail(errors, "revenue_must_be_positive")
    else: ok("revenue valid")

def validate_top_sections(d, errors):
    if not d.get("top_procedures"): fail(errors, "top_procedures_empty")
    else: ok("top_procedures valid")
    if not d.get("top_channels"): fail(errors, "top_channels_empty")
    else: ok("top_channels valid")
    if not isinstance(d.get("insights"), list): fail(errors, "insights_invalid")
    else: ok("insights valid")

def validate_trend(d, errors):
    trend = d.get("trend", {})
    if not trend.get("daily"): fail(errors, "trend_daily_empty")
    else: ok("trend daily valid")
    comp = trend.get("comparison", {})
    required = ["previous_period_revenue","previous_period_conversion","revenue_growth_rate","conversion_growth_rate"]
    missing = [x for x in required if x not in comp]
    if missing: fail(errors, f"trend_comparison_missing:{missing}")
    else: ok("trend comparison valid")

def validate_bookings(d, errors):
    bookings = d.get("bookings", {})
    if not isinstance(bookings.get("recent"), list): fail(errors, "bookings_recent_invalid")
    else: ok("bookings recent valid")
    summary = bookings.get("summary", {})
    missing = [x for x in ["pending","confirmed","completed","cancelled"] if x not in summary]
    if missing: fail(errors, f"bookings_summary_missing:{missing}")
    else: ok("bookings summary valid")

def validate_role(d, errors):
    role = d.get("meta", {}).get("role", "")
    if role == "owner":
        if not d.get("affiliate",{}).get("enabled"): fail(errors, "owner_affiliate_not_enabled")
        else: ok("owner affiliate enabled")
        if not d.get("agent",{}).get("enabled"): fail(errors, "owner_agent_not_enabled")
        else: ok("owner agent enabled")
        if not d.get("branch_performance",{}).get("enabled"): fail(errors, "owner_branch_not_enabled")
        else: ok("owner branch enabled")
    elif role == "affiliate":
        if not d.get("affiliate",{}).get("enabled"): fail(errors, "affiliate_not_enabled")
        else: ok("affiliate enabled")
    elif role == "agent":
        if not d.get("agent",{}).get("enabled"): fail(errors, "agent_not_enabled")
        else: ok("agent enabled")
    elif role == "branch":
        if not d.get("branch_performance",{}).get("enabled"): fail(errors, "branch_not_enabled")
        else: ok("branch enabled")
    elif role == "clinic": ok("clinic basic valid")
    else: fail(errors, f"unknown_role:{role}")

def validate_dashboard(path):
    print("DASHBOARD VALIDATOR\n")
    errors = []
    d = load_dashboard(path)
    validate_meta(d, errors)
    validate_overview(d, errors)
    validate_funnel(d, errors)
    validate_kpi(d, errors)
    validate_top_sections(d, errors)
    validate_trend(d, errors)
    validate_bookings(d, errors)
    validate_role(d, errors)
    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL")
        for e in errors: print(" -", e)
        return 1
    print("FINAL RESULT: PASS — DASHBOARD VALID")
    return 0

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else INPUT_FILE
    sys.exit(validate_dashboard(path))
