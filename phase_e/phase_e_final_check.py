
import json
from collections import defaultdict
from analytics_engine_v3 import run as get_analytics
from insight_engine_v2 import generate_insights

def fail(msg): return False, msg
def ok(msg): return True, msg

def check_conversion(analytics):
    conv = analytics["conversion"]
    if conv < 0.08: return fail(f"conversion {conv:.2%} < 8%")
    return ok(f"conversion {conv:.2%}")

def check_ctr(analytics):
    ctr = analytics["ctr"]
    if ctr < 0.05: return fail(f"CTR {ctr:.2%} < 5%")
    return ok(f"CTR {ctr:.2%}")

def check_revenue(analytics):
    rev = analytics["revenue"]
    if rev <= 0: return fail("revenue = 0")
    return ok(f"revenue = {rev}")

def check_insights(insights):
    if insights["best_procedure"] == "N/A": return fail("no best procedure")
    if insights["best_cta"] == "N/A": return fail("no best CTA")
    if not insights["conversion_status"]: return fail("no conversion status")
    return ok(f"insights OK — best={insights['best_procedure']} cta={insights['best_cta']}")

def check_funnel():
    session_events = defaultdict(set)
    with open("./logs/events.jsonl", encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            session_events[e["session_id"]].add(e["event_type"])
    valid = sum(1 for evs in session_events.values() if "procedure_viewed" in evs and "cta_clicked" in evs)
    if valid == 0: return fail("no valid funnel")
    return ok(f"{valid} valid funnel sessions")

def check_cta_performance(analytics):
    if not analytics["cta_performance"]: return fail("no CTA performance data")
    return ok(f"{len(analytics['cta_performance'])} CTAs tracked")

def run():
    print("\n" + "="*60)
    print("🚀 PHASE E FINAL CHECK")
    print("="*60)

    analytics = get_analytics()
    insights = generate_insights()

    checks = [
        ("CONVERSION", lambda: check_conversion(analytics)),
        ("CTR", lambda: check_ctr(analytics)),
        ("REVENUE", lambda: check_revenue(analytics)),
        ("INSIGHTS", lambda: check_insights(insights)),
        ("FUNNEL", check_funnel),
        ("CTA_PERFORMANCE", lambda: check_cta_performance(analytics)),
    ]

    all_pass = True
    for name, fn in checks:
        ok_flag, msg = fn()
        status = "PASS" if ok_flag else "FAIL"
        print(f"{name}: {status} — {msg}")
        if not ok_flag: all_pass = False

    print("\n" + "="*60)
    if all_pass:
        print("🎉 PHASE E COMPLETE — READY FOR PHASE F")
    else:
        print("❌ FAIL — FIX REQUIRED")
    print("="*60)

if __name__ == "__main__":
    run()
