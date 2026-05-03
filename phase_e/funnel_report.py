
import json

LOG_FILE = "./logs/events.jsonl"

shown = viewed = clicked = booked = inputs = 0

with open(LOG_FILE, encoding="utf-8") as f:
    for line in f:
        e = json.loads(line)
        if e["event_type"] == "user_input": inputs += 1
        elif e["event_type"] == "cta_shown": shown += 1
        elif e["event_type"] == "cta_clicked": clicked += 1
        elif e["event_type"] == "procedure_viewed": viewed += 1
        elif e["event_type"] == "booking_completed": booked += 1

ctr = clicked / shown if shown else 0
cvr = booked / inputs if inputs else 0

print("\nFUNNEL REPORT")
print(f"Input:      {inputs}")
print(f"CTA Shown:  {shown}")
print(f"Clicked:    {clicked}")
print(f"Viewed:     {viewed}")
print(f"Booked:     {booked}")
print(f"CTR:        {round(ctr*100,2)}%  (clicked/shown)")
print(f"Conversion: {round(cvr*100,2)}%  (booked/input)")
