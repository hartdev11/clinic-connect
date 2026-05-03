
import json
from collections import defaultdict

class Optimizer:
    def __init__(self, log_file="./logs/events.jsonl"):
        self.log_file = log_file
        self.events = []
        self._load_events()

    def _load_events(self):
        with open(self.log_file, encoding="utf-8") as f:
            for line in f:
                self.events.append(json.loads(line))

    def compute_procedure_stats(self):
        stats = defaultdict(lambda: {"views": 0, "bookings": 0})
        for e in self.events:
            if e["event_type"] == "procedure_viewed":
                stats[e["data"]["procedure_id"]]["views"] += 1
            elif e["event_type"] == "booking_completed":
                stats[e["data"]["procedure_id"]]["bookings"] += 1
        return stats

    def compute_scores(self, stats):
        scores = {}
        for proc, s in stats.items():
            views = s["views"]
            bookings = s["bookings"]
            conversion_rate = bookings / views if views > 0 else 0
            score = (bookings + 1) / (views + 5)
            scores[proc] = {"conversion_rate": conversion_rate, "score": score, "views": views, "bookings": bookings}
        return scores

    def normalize_scores(self, scores):
        values = [v["score"] for v in scores.values()]
        if not values: return {}
        min_v, max_v = min(values), max(values)
        normalized = {}
        for proc, v in scores.items():
            norm = (v["score"] - min_v) / (max_v - min_v) if max_v - min_v != 0 else 1.0
            normalized[proc] = {**v, "weight": round(norm, 4)}
        return normalized

    def save_weights(self, weights, path="./weights.json"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(weights, f, ensure_ascii=False, indent=2)

    def run(self):
        stats = self.compute_procedure_stats()
        scores = self.compute_scores(stats)
        weights = self.normalize_scores(scores)
        self.save_weights(weights)
        return weights

if __name__ == "__main__":
    optimizer = Optimizer()
    weights = optimizer.run()
    print("\n🔥 OPTIMIZATION COMPLETE")
    for proc, data in sorted(weights.items(), key=lambda x: x[1]["weight"], reverse=True)[:10]:
        print(f"{proc}: weight={data['weight']}")
