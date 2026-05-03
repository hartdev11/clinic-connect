
import json
import random
from datetime import datetime, timedelta

OUTPUT_FILE = "events.jsonl"

PROCEDURES = [f"proc_{i:03d}" for i in range(1, 21)]
CHANNELS = ["facebook", "google", "line", "tiktok"]
BRANCHES = ["bkk_01", "bkk_02", "cnx_01"]
CTA_IDS = ["cta_01", "cta_02", "cta_03", "cta_04", "cta_05"]

NUM_USERS = 500
MAX_SESSIONS_PER_USER = 3

def random_time(days_back=7):
    now = datetime.utcnow()
    delta = timedelta(days=random.randint(0, days_back),
                      hours=random.randint(0, 23),
                      minutes=random.randint(0, 59))
    return (now - delta).isoformat() + "Z"

def generate_event(event_type, session_id, user_id, procedure_id):
    event = {
        "timestamp": random_time(),
        "session_id": session_id,
        "customer_id": user_id,
        "event_type": event_type,
        "procedure_id": procedure_id,
        "channel": random.choice(CHANNELS),
        "branch_id": random.choice(BRANCHES),
        "cta_id": random.choice(CTA_IDS),
        "variant": "A" if random.random() < 0.5 else "B",
        "intent_level": random.choice(["high", "medium", "low"])
    }
    if event_type == "booking_completed":
        event["revenue"] = random.randint(5000, 20000)
    return event

def main():
    print("🎲 Generating realistic mock events...\n")
    events = []

    for u in range(NUM_USERS):
        user_id = f"user_{u:04d}"
        sessions = random.randint(1, MAX_SESSIONS_PER_USER)

        for s in range(sessions):
            session_id = f"{user_id}_sess_{s}"
            procedure_id = random.choice(PROCEDURES)

            # 20% bounce
            if random.random() < 0.2:
                continue

            # VIEW
            events.append(generate_event("procedure_viewed", session_id, user_id, procedure_id))

            # CTR 12%
            if random.random() < 0.12:
                events.append(generate_event("cta_clicked", session_id, user_id, procedure_id))

                # Booking 70% จาก click
                if random.random() < 0.85:
                    events.append(generate_event("booking_completed", session_id, user_id, procedure_id))

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e) + "\n")

    print(f"✅ Generated {len(events)} events → {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
