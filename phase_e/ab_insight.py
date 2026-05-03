
import json
from collections import defaultdict

LOG_FILE = "./logs/events.jsonl"

CTA_DESC = {
    "A": "โปรโมชั่นลดราคา + urgency",
    "B": "รีวิว + ความน่าเชื่อถือ"
}

sessions = {}
stats = defaultdict(lambda: {"shown": 0, "booked": 0})

with open(LOG_FILE, encoding="utf-8") as f:
    for line in f:
        e = json.loads(line)
        sid = e.get("session_id")
        if sid not in sessions:
            sessions[sid] = "A" if hash(sid) % 2 == 0 else "B"
        v = sessions[sid]
        if e["event_type"] == "cta_shown": stats[v]["shown"] += 1
        elif e["event_type"] == "booking_completed": stats[v]["booked"] += 1

print("\nA/B TEST INSIGHT")
conv = {}
for v in ["A", "B"]:
    s = stats[v]["shown"]
    b = stats[v]["booked"]
    conv[v] = b / s if s > 0 else 0
    print(f"Variant {v} ({CTA_DESC[v]}): shown={s} booked={b} conv={round(conv[v]*100,2)}%")

winner = max(conv, key=conv.get)
print(f"\n🏆 Winner: Variant {winner} — {CTA_DESC[winner]}")
print(f"👉 เพราะ CTA แบบ {CTA_DESC[winner]} ปิดการขายได้ดีกว่า")
