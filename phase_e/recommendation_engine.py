
from typing import Dict, List
import random

CONCERN_PROCEDURE_MAP = {
    "หน้าเรียว": ["proc_001", "proc_006", "proc_021"],
    "กราม": ["proc_001", "proc_004", "proc_021"],
    "ริ้วรอย": ["proc_001", "proc_023", "proc_006"],
    "ฟิลเลอร์": ["proc_006", "proc_007", "proc_013"],
    "botox": ["proc_001", "proc_002", "proc_003"],
    "ยกกระชับ": ["proc_021", "proc_023", "proc_061"],
    "สิว": ["proc_026", "proc_028", "proc_046"],
    "ฝ้า": ["proc_029", "proc_030", "proc_065"],
    "เลเซอร์": ["proc_029", "proc_028", "proc_030"],
    "ไขมัน": ["proc_069", "proc_067", "proc_055"],
    "ผมร่วง": ["proc_077", "proc_078", "proc_060"],
    "ผิว": ["proc_008", "proc_041", "proc_042"],
    "ulthera": ["proc_021", "proc_022", "proc_023"],
    "thermage": ["proc_023", "proc_021", "proc_024"],
    "hifu": ["proc_022", "proc_021", "proc_031"],
    "filler": ["proc_006", "proc_007", "proc_013"],
}

DEFAULT_PROCEDURES = ["proc_001", "proc_006", "proc_021"]

class RecommendationEngine:

    def __init__(self, context_loader):
        self.context_loader = context_loader

    def recommend(self, intent_data: Dict, state: Dict, user_input: str) -> List[str]:
        clean_text = intent_data.get("clean_text", "").lower()

        matched = []
        for keyword, procs in CONCERN_PROCEDURE_MAP.items():
            if keyword in clean_text:
                for p in procs:
                    if p not in matched:
                        matched.append(p)

        if not matched:
            procedures = self.context_loader.data["procedures"]
            scored = []
            for proc in procedures:
                score = 0
                name = proc.get("name", "").lower()
                indications = " ".join(proc.get("indications", [])).lower()
                for word in clean_text.split():
                    if len(word) > 2:
                        if word in name:
                            score += 3
                        if word in indications:
                            score += 2
                if score > 0:
                    scored.append({"id": proc.get("id"), "score": score})
            scored.sort(key=lambda x: x["score"], reverse=True)
            if scored:
                matched = [s["id"] for s in scored[:3]]
            else:
                matched = DEFAULT_PROCEDURES

        return matched[:3]
