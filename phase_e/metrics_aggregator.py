
import json
from collections import defaultdict

def aggregate(log_file="./logs/events.jsonl"):
    metrics = {
        "total_events": 0,
        "sessions": set(),
        "bookings": 0,
        "revenue": 0,
        "cta_clicks": defaultdict(int),
        "cta_bookings": defaultdict(int),
        "views": 0,
        "clicks": 0
    }
    with open(log_file, encoding="utf-8") as f:
        for line in f:
            e = json.loads(line)
            metrics["total_events"] += 1
            metrics["sessions"].add(e.get("session_id"))
            etype = e.get("event_type")
            cta_id = e.get("cta_id", "unknown")
            if etype == "procedure_viewed": metrics["views"] += 1
            elif etype == "cta_clicked":
                metrics["clicks"] += 1
                metrics["cta_clicks"][cta_id] += 1
            elif etype == "booking_completed":
                metrics["bookings"] += 1
                metrics["revenue"] += e.get("revenue", 0)
                metrics["cta_bookings"][cta_id] += 1
    metrics["sessions"] = len(metrics["sessions"])
    return metrics
