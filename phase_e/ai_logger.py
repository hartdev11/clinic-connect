import json
import os
from datetime import datetime
from typing import Dict


class AILogger:

    def __init__(self, log_path: str = "./logs"):
        self.log_path = log_path
        os.makedirs(log_path, exist_ok=True)

    def log(self, user_id: str, input_text: str, output: Dict):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "user_id": user_id,
            "input": input_text,
            "intent": output.get("intent"),
            "stage": output.get("stage"),
            "recommendations": output.get("recommendations", []),
            "response": output.get("response"),
            "cta": output.get("cta"),
            "media": output.get("media")
        }

        log_file = os.path.join(self.log_path, "ai_logs.jsonl")

        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    def get_stats(self) -> Dict:
        log_file = os.path.join(self.log_path, "ai_logs.jsonl")

        if not os.path.exists(log_file):
            return {"total_logs": 0}

        logs = []
        with open(log_file, encoding="utf-8") as f:
            for line in f:
                logs.append(json.loads(line))

        from collections import Counter
        intents = Counter(l.get("intent") for l in logs)
        stages = Counter(l.get("stage") for l in logs)

        return {
            "total_logs": len(logs),
            "intent_distribution": dict(intents),
            "stage_distribution": dict(stages)
        }


if __name__ == "__main__":
    logger = AILogger("./logs")
    logger.log("user_001", "อยากหน้าเรียว", {
        "intent": "consultation",
        "stage": "awareness",
        "recommendations": [{"procedure_id": "proc_001"}],
        "response": "แนะนำ Botox ค่ะ",
        "cta": "จองคิวได้เลยค่ะ",
        "media": None
    })
    print(logger.get_stats())
