
import json
from collections import defaultdict, Counter
from datetime import datetime

EVENT_FILE = "events.jsonl"

def parse_time(ts):
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))

def load_events():
    events = []
    with open(EVENT_FILE, "r", encoding="utf-8") as f:
        for line in f:
            events.append(json.loads(line))
    return events

def aggregate(events):
    sessions = defaultdict(list)
    procedure_counter = Counter()
    procedure_revenue = defaultdict(float)
    channel_counter = Counter()
    branch_counter = Counter()
    cta_clicks = defaultdict(int)
    cta_bookings = defaultdict(int)

    total_revenue = 0
    views = clicks = bookings = 0

    for e in events:
        sid = e["session_id"]
        sessions[sid].append(e)
        cta_id = e.get("cta_id", "unknown")

        if e["event_type"] == "procedure_viewed":
            views += 1
            procedure_counter[e.get("procedure_id", "unknown")] += 1
        elif e["event_type"] == "cta_clicked":
            clicks += 1
            cta_clicks[cta_id] += 1
        elif e["event_type"] == "booking_completed":
            bookings += 1
            rev = e.get("revenue", 0)
            total_revenue += rev
            procedure_revenue[e.get("procedure_id", "unknown")] += rev
            cta_bookings[cta_id] += 1

        channel_counter[e.get("channel", "unknown")] += 1
        branch_counter[e.get("branch_id", "unknown")] += 1

    total_sessions = len(sessions)
    total_users = len(set(e.get("customer_id", "unknown") for e in events))

    conversion = bookings / total_sessions if total_sessions else 0
    ctr = clicks / views if views else 0

    top_procedures = [
        {"procedure_id": pid, "views": procedure_counter[pid], "revenue": procedure_revenue[pid]}
        for pid, _ in procedure_counter.most_common(10)
    ]

    metrics = {
        "summary": {
            "total_events": len(events),
            "total_users": total_users,
            "total_sessions": total_sessions,
            "views": views,
            "clicks": clicks,
            "bookings": bookings,
            "conversion_rate": round(conversion, 4),
            "ctr": round(ctr, 4),
            "total_revenue": round(total_revenue, 2)
        },
        "funnel": {"view": views, "click": clicks, "booking": bookings},
        "top_procedures": top_procedures,
        "revenue_by_procedure": dict(procedure_revenue),
        "events_by_channel": dict(channel_counter),
        "events_by_branch": dict(branch_counter),
        "cta_clicks": dict(cta_clicks),
        "cta_bookings": dict(cta_bookings)
    }
    return metrics

def save_metrics(metrics):
    with open("metrics_output.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

def main():
    print("📊 Running Metrics Aggregator...\n")
    events = load_events()
    metrics = aggregate(events)
    save_metrics(metrics)
    print("✅ Metrics generated: metrics_output.json")
    print("\n📈 SUMMARY")
    for k, v in metrics["summary"].items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    main()
