
import json
import os

class WeightManager:
    def __init__(self, weight_path="./weights.json"):
        self.weight_path = weight_path
        self.weights = self._load_weights()

    def _load_weights(self):
        if not os.path.exists(self.weight_path):
            print("⚠️ weights.json not found — using default weights")
            return {}
        with open(self.weight_path, encoding="utf-8") as f:
            return json.load(f)

    def get_weight(self, procedure_id: str) -> float:
        if procedure_id in self.weights:
            return self.weights[procedure_id].get("weight", 0.0)
        return 0.0

    def apply_weight(self, procedure_id: str, base_score: float) -> float:
        weight = self.get_weight(procedure_id)
        return base_score * (1 + weight)

    def apply_to_ranked_list(self, ranked_items: list):
        updated = []
        for item in ranked_items:
            proc_id = item["procedure_id"]
            base_score = item.get("score", 0)
            new_score = self.apply_weight(proc_id, base_score)
            updated.append({**item, "score": new_score, "weight": self.get_weight(proc_id)})
        updated.sort(key=lambda x: x["score"], reverse=True)
        return updated

if __name__ == "__main__":
    manager = WeightManager()
    dummy_rank = [
        {"procedure_id": "proc_021", "score": 0.8},
        {"procedure_id": "proc_006", "score": 0.7},
        {"procedure_id": "proc_010", "score": 0.6}
    ]
    updated = manager.apply_to_ranked_list(dummy_rank)
    print("\n🔥 UPDATED RANKING:")
    for r in updated:
        print(r)
