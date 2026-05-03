
import random
import uuid
from event_logger import EventLogger
from dashboard_mock_data import CLICK_RATE, BOOKING_RATE
from intent_classifier import classify_intent
from cta_engine import generate_cta

PROCEDURES = [
    "proc_001","proc_002","proc_003","proc_004","proc_005",
    "proc_006","proc_007","proc_008","proc_009","proc_010",
    "proc_011","proc_012","proc_013","proc_014","proc_015",
    "proc_016","proc_017","proc_018","proc_019","proc_020",
    "proc_021","proc_022","proc_023","proc_024","proc_025",
    "proc_026","proc_027","proc_028","proc_029","proc_030",
    "proc_031","proc_032","proc_033","proc_034","proc_035",
    "proc_036","proc_037","proc_038","proc_039","proc_040",
    "proc_041","proc_042","proc_043","proc_044","proc_045",
    "proc_046","proc_047","proc_048","proc_049","proc_050",
    "proc_051","proc_052","proc_053","proc_054","proc_055",
    "proc_056","proc_057","proc_058","proc_059","proc_060",
    "proc_061","proc_062","proc_063","proc_064","proc_065"
]

PRICES = {p: random.randint(5000, 30000) for p in PROCEDURES}
CHANNELS = ["web", "line", "facebook"]
BRANCHES = ["branch_1", "branch_2", "branch_3"]
MESSAGES = ["ราคาเท่าไหร่", "อยากจอง", "ดีไหม", "โปรวันนี้", "อันไหนดี", "ช่วยอะไร"]

def get_intent_level(msg):
    return classify_intent(msg)

def simulate_user(logger, session_id):
    proc = random.choice(PROCEDURES)
    price = PRICES.get(proc, 5000)
    channel = random.choice(CHANNELS)
    branch_id = random.choice(BRANCHES)
    variant = "A" if hash(session_id) % 2 == 0 else "B"
    message = random.choice(MESSAGES)
    intent_level = get_intent_level(message)
    cta = generate_cta()
    customer_id = f"cust_{session_id[:8]}"

    extra = {
        "customer_id": customer_id,
        "branch_id": branch_id,
        "channel": channel,
        "variant": variant,
        "cta_id": cta["cta_id"],
        "intent_level": intent_level
    }

    logger.log(session_id, "user_input", {"text": message, "intent": intent_level, "procedure_id": proc}, extra)
    logger.log(session_id, "ai_response", {"response_text": "แนะนำ", "recommendations": [proc], "cta": cta["text"], "stage": "awareness", "procedure_id": proc}, extra)
    logger.log(session_id, "cta_shown", {"cta": cta["text"], "procedure_ids": [proc], "procedure_id": proc}, extra)

    # CTR ใช้ CLICK_RATE = 0.75
    if random.random() > CLICK_RATE:
        return

    logger.log(session_id, "cta_clicked", {"cta": cta["text"], "procedure_id": proc}, extra)

    # view 1-2 procedures
    choices = random.sample(PROCEDURES, k=random.randint(1, 2))
    for c in choices:
        logger.log(session_id, "procedure_viewed", {"procedure_id": c}, extra)
    logger.log(session_id, "procedure_viewed", {"procedure_id": proc}, extra)

    # BOOKING_RATE = 0.45
    if random.random() > BOOKING_RATE:
        return

    logger.log(session_id, "procedure_selected", {"procedure_id": proc}, extra)
    logger.log(session_id, "booking_started", {"procedure_id": proc}, extra)

    logger.log(session_id, "booking_completed", {
        "procedure_id": proc,
        "revenue_estimate": price,
        "price": price
    }, extra)

def run_simulation(n_users=1000):
    logger = EventLogger()
    for _ in range(n_users):
        session_id = str(uuid.uuid4())
        simulate_user(logger, session_id)
    print(f"Simulation done: {n_users} users")

if __name__ == "__main__":
    run_simulation(1000)
