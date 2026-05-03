
import os
import json
from datetime import datetime
from collections import defaultdict

LOG_FILE = "./logs/events.jsonl"
WEIGHT_FILE = "./weights.json"
MIN_EVENTS = 500
MIN_PROCEDURES_USED = 20
MIN_CONVERSION_RATE = 0.05
MIN_REVENUE = 1000

def fail(msg): return False, msg
def ok(msg): return True, msg

def check_files():
    if not os.path.exists(LOG_FILE): return fail("missing events.jsonl")
    if not os.path.exists(WEIGHT_FILE): return fail("missing weights.json")
    return ok("files exist")

def check_events():
    total = 0
    event_types = set()
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            total += 1
            try:
                e = json.loads(line)
                event_types.add(e.get("event_type"))
            except:
                return fail("invalid JSON")
    required = {"procedure_viewed", "cta_shown", "cta_clicked", "booking_completed"}
    if total < MIN_EVENTS: return fail(f"too few events ({total})")
    if not required.issubset(event_types): return fail(f"missing events {required - event_types}")
    return ok(f"{total} events OK")

def check_distribution():
    procedures = set()
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            pid = e.get("procedure_id") or e.get("data", {}).get("procedure_id")
            if pid: procedures.add(pid)
    if len(procedures) < MIN_PROCEDURES_USED: return fail(f"too few procedures ({len(procedures)})")
    return ok(f"{len(procedures)} procedures used")

def check_weights():
    with open(WEIGHT_FILE, encoding="utf-8") as f:
        data = json.load(f)
    if not data: return fail("weights empty")
    for k, v in data.items():
        if "weight" not in v: return fail(f"{k} missing weight")
    return ok(f"{len(data)} weights OK")

def check_metrics():
    viewed = booked = revenue = 0
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            if e["event_type"] == "procedure_viewed": viewed += 1
            elif e["event_type"] == "booking_completed":
                booked += 1
                revenue += e.get("revenue", 0) or e.get("data", {}).get("price", 0)
    if viewed == 0: return fail("no views")
    conversion = booked / viewed
    if conversion < MIN_CONVERSION_RATE: return fail(f"low conversion {round(conversion,3)}")
    if revenue < MIN_REVENUE: return fail(f"low revenue {revenue}")
    return ok(f"conversion={round(conversion,3)}, revenue={revenue}")

def check_ab_test():
    sessions = {}
    variant_stats = defaultdict(lambda: {"shown": 0, "booked": 0})
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            sid = e.get("session_id")
            v = e.get("variant") or ("A" if hash(sid) % 2 == 0 else "B")
            if sid not in sessions: sessions[sid] = v
            v = sessions[sid]
            if e["event_type"] == "cta_shown": variant_stats[v]["shown"] += 1
            elif e["event_type"] == "booking_completed": variant_stats[v]["booked"] += 1
    if not variant_stats: return fail("no A/B data")
    conv = {}
    for v in ["A", "B"]:
        s = variant_stats[v]["shown"]
        b = variant_stats[v]["booked"]
        conv[v] = b / s if s > 0 else 0
    if conv["A"] == conv["B"]: return fail("no difference in A/B")
    winner = max(conv, key=conv.get)
    return ok(f"A={round(conv['A'],3)} B={round(conv['B'],3)} winner={winner}")

def check_new_fields():
    errors = []
    revenue_found = False
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            if not e.get("channel"): errors.append("missing channel")
            if not e.get("intent_level"): errors.append("missing intent_level")
            if not e.get("branch_id"): errors.append("missing branch_id")
            if not e.get("variant"): errors.append("missing variant")
            try:
                datetime.strptime(e.get("timestamp",""), "%Y-%m-%dT%H:%M:%SZ")
            except:
                errors.append("invalid timestamp")
            if e["event_type"] == "booking_completed":
                rev = e.get("revenue", 0)
                if rev > 0: revenue_found = True
            if len(errors) > 3: break
    if errors: return fail(f"field errors: {set(errors)}")
    if not revenue_found: return fail("no booking with revenue > 0")
    return ok("all new fields OK")

def run_all():
    print("\n" + "="*60)
    print("🚀 PHASE E FULL VALIDATION")
    print("="*60)
    checks = [
        ("FILES", check_files),
        ("EVENTS", check_events),
        ("DISTRIBUTION", check_distribution),
        ("WEIGHTS", check_weights),
        ("METRICS", check_metrics),
        ("AB_TEST", check_ab_test),
        ("NEW_FIELDS", check_new_fields),
    ]
    all_pass = True
    for name, fn in checks:
        ok_flag, msg = fn()
        status = "PASS" if ok_flag else "FAIL"
        print(f"{name}: {status} — {msg}")
        if not ok_flag: all_pass = False
    print("\n" + "="*60)
    if all_pass:
        print("🎉 SYSTEM PASS — READY FOR PRODUCTION")
    else:
        print("❌ SYSTEM FAIL — FIX REQUIRED")
    print("="*60)

if __name__ == "__main__":
    run_all()
