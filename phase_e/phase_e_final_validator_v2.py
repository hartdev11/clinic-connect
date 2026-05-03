import json
from collections import defaultdict, Counter
from datetime import datetime

EVENT_FILE = "./logs/events.jsonl"

REQUIRED_FIELDS = ["timestamp","event_type","session_id","procedure_id","variant"]
PATCH_FIELDS = ["customer_id","branch_id","channel","cta_id","intent_level"]

def parse_time(ts):
    try:
        datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return True
    except:
        return False

def load_events():
    events = []
    with open(EVENT_FILE, "r", encoding="utf-8") as f:
        for line in f:
            events.append(json.loads(line))
    return events

def validate_fields(events):
    errors = []
    for i, e in enumerate(events):
        for f in REQUIRED_FIELDS:
            if f not in e:
                errors.append(f"Missing {f} in event {i}")
        for f in PATCH_FIELDS:
            if f not in e:
                errors.append(f"Missing PATCH field {f} in event {i}")
    return errors

def validate_timestamp(events):
    errors = []
    for i, e in enumerate(events):
        if not parse_time(e["timestamp"]):
            errors.append(f"Invalid timestamp in event {i}")
    return errors

def validate_funnel(events):
    session_events = defaultdict(set)
    for e in events:
        session_events[e["session_id"]].add(e["event_type"])
    valid_sessions = sum(1 for s, evs in session_events.items() if "procedure_viewed" in evs and "cta_clicked" in evs)
    if valid_sessions == 0:
        return ["No valid funnel (view → click) found"]
    return []

def validate_revenue(events):
    errors = []
    revenues = []
    for e in events:
        if e["event_type"] == "booking_completed":
            if "revenue" not in e or e["revenue"] <= 0:
                errors.append("Booking without revenue > 0")
            else:
                revenues.append(e["revenue"])
    if len(revenues) == 0:
        errors.append("No revenue found")
    return errors

def validate_intent(events):
    errors = []
    valid = {"high", "medium", "low"}
    for e in events:
        if e.get("intent_level") not in valid:
            errors.append(f"Invalid intent_level: {e.get('intent_level')}")
    return errors

def validate_variant(events):
    errors = []
    for e in events:
        if e.get("variant") not in ["A", "B"]:
            errors.append(f"Invalid variant: {e.get('variant')}")
    return errors

def validate_procedure_usage(events):
    procedures = set()
    for e in events:
        if e.get("procedure_id"):
            procedures.add(e["procedure_id"])
    if len(procedures) < 10:
        return ["Too few procedures used (<10)"]
    return []

def validate_channel(events):
    errors = []
    for e in events:
        if e.get("channel") not in ["web", "line", "facebook"]:
            errors.append(f"Invalid channel: {e.get('channel')}")
    return errors

def summary(events):
    total = len(events)
    sessions = set(e["session_id"] for e in events)
    bookings = [e for e in events if e["event_type"] == "booking_completed"]
    clicks = [e for e in events if e["event_type"] == "cta_clicked"]
    conversion = len(bookings) / len(sessions) if sessions else 0
    ctr = len(clicks) / total if total else 0
    revenue = sum(e.get("revenue", 0) for e in bookings)
    print("\n📊 SUMMARY")
    print(f"Events: {total}")
    print(f"Sessions: {len(sessions)}")
    print(f"Bookings: {len(bookings)}")
    print(f"Conversion: {conversion:.2%}")
    print(f"CTR: {ctr:.2%}")
    print(f"Revenue: {revenue}")

def main():
    print("🔍 Phase E Final Validator v2\n")
    events = load_events()
    checks = [
        ("Field Check", validate_fields),
        ("Timestamp Check", validate_timestamp),
        ("Funnel Check", validate_funnel),
        ("Revenue Check", validate_revenue),
        ("Intent Check", validate_intent),
        ("Variant Check", validate_variant),
        ("Procedure Coverage", validate_procedure_usage),
        ("Channel Check", validate_channel),
    ]
    all_errors = []
    for name, fn in checks:
        errors = fn(events)
        if errors:
            print(f"❌ {name} FAILED")
            for e in errors[:5]:
                print("   -", e)
            all_errors.extend(errors)
        else:
            print(f"✅ {name} PASSED")
    summary(events)
    print("\n==========================")
    if all_errors:
        print(f"❌ VALIDATION FAILED ({len(all_errors)} issues)")
    else:
        print("🎉 ALL CHECKS PASSED — READY FOR PHASE F")

if __name__ == "__main__":
    main()
