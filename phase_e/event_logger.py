
import json
import os
import random
from datetime import datetime, timezone
from typing import Dict

CHANNELS = ["web", "line", "facebook"]
INTENT_LEVELS = ["high", "medium", "low"]

class EventLogger:
    def __init__(self, log_file="./logs/events.jsonl"):
        self.log_file = log_file
        os.makedirs(os.path.dirname(log_file), exist_ok=True)

    def log(self, session_id: str, event_type: str, data: Dict = {}, extra: Dict = {}):
        entry = {
            "session_id": session_id,
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "event_type": event_type,
            "customer_id": extra.get("customer_id", f"cust_{session_id[:8]}"),
            "branch_id": extra.get("branch_id", "branch_1"),
            "channel": extra.get("channel", "web"),
            "variant": extra.get("variant", "A"),
            "cta_id": extra.get("cta_id", "cta_01"),
            "intent_level": extra.get("intent_level", "medium"),
            "revenue": data.get("price", 0) if event_type == "booking_completed" else 0,
            "procedure_id": data.get("procedure_id", None),
            "data": data
        }
        with open(self.log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
