
from typing import Dict, List
import yaml
import os

class MediaSelector:
    def __init__(self, dataset_path: str = "./dataset"):
        self.dataset_path = dataset_path
        self.media_data = self._load_yaml("media_assets.yaml")

    def _load_yaml(self, filename: str) -> List[Dict]:
        path = os.path.join(self.dataset_path, filename)
        if not os.path.exists(path):
            print(f"[WARNING] Missing {filename}")
            return []
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or []

    def select(self, procedure_id: str, state: Dict) -> Dict:
        stage = state.get("conversation_stage", "awareness")
        candidates = [m for m in self.media_data if m.get("procedure_id") == procedure_id]
        if not candidates:
            return {}
        scored = []
        for media in candidates:
            score = 0.0
            perf = media.get("performance", {})
            score += perf.get("conversion_rate", 0) * 5
            score += perf.get("click_rate", 0) * 2
            if stage == "decision" and media.get("type") == "before_after":
                score += 1.0
            if stage == "awareness" and media.get("type") == "review":
                score += 0.5
            scored.append({"media": media, "score": score})
        best = sorted(scored, key=lambda x: x["score"], reverse=True)[0]
        selected = best["media"]
        return {
            "media_url": selected.get("url"),
            "type": selected.get("type"),
            "score": round(best["score"], 4),
            "media_id": selected.get("id")
        }
