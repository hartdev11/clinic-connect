
import json
from collections import defaultdict

def generate_insights(log_file="./logs/events.jsonl"):
    proc_views = defaultdict(int)
    proc_bookings = defaultdict(int)
    cta_clicks = defaultdict(int)
    cta_bookings = defaultdict(int)

    with open(log_file, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            pid = e.get("procedure_id")
            cta_id = e.get("cta_id", "unknown")
            if e["event_type"] == "procedure_viewed" and pid:
                proc_views[pid] += 1
            elif e["event_type"] == "booking_completed" and pid:
                proc_bookings[pid] += 1
                cta_bookings[cta_id] += 1
            elif e["event_type"] == "cta_clicked":
                cta_clicks[cta_id] += 1

    # best procedure
    best_proc = max(proc_bookings, key=proc_bookings.get) if proc_bookings else "N/A"

    # best CTA
    best_cta = max(cta_bookings, key=cta_bookings.get) if cta_bookings else "N/A"

    # conversion status
    total_views = sum(proc_views.values())
    total_bookings = sum(proc_bookings.values())
    conv = total_bookings / total_views if total_views else 0
    status = "GOOD" if conv >= 0.08 else "NEEDS IMPROVEMENT"

    insights = {
        "best_procedure": best_proc,
        "best_cta": best_cta,
        "conversion_status": status,
        "conversion_rate": round(conv, 4)
    }

    print("\n🧠 INSIGHTS")
    print(f"Best Procedure: {best_proc} ({proc_bookings.get(best_proc,0)} bookings)")
    print(f"Best CTA: {best_cta} ({cta_bookings.get(best_cta,0)} bookings)")
    print(f"Conversion Status: {status} ({conv:.2%})")

    return insights

if __name__ == "__main__":
    generate_insights()
