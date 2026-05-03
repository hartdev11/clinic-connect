
import json
from collections import defaultdict

LOG_FILE = "./logs/events.jsonl"

stats = defaultdict(lambda: {"view": 0, "book": 0})

with open(LOG_FILE, encoding="utf-8") as f:
    for line in f:
        e = json.loads(line)
        pid = e.get("data", {}).get("procedure_id")
        if not pid:
            continue
        if e["event_type"] == "procedure_viewed": stats[pid]["view"] += 1
        elif e["event_type"] == "booking_completed": stats[pid]["book"] += 1

results = []
for pid, s in stats.items():
    if s["view"] > 0:
        conv = s["book"] / s["view"]
        results.append((pid, conv, s["book"]))

results.sort(key=lambda x: x[1], reverse=True)

print("\nTOP 5 PROCEDURES")
for r in results[:5]:
    print(f"{r[0]} → conv={round(r[1]*100,2)}% | bookings={r[2]}")
