
import json
from collections import defaultdict

class ABTestManager:
    def __init__(self, log_file="./logs/events.jsonl"):
        self.log_file = log_file
        self.events = []
        self._load_events()

    def _load_events(self):
        try:
            with open(self.log_file, encoding="utf-8") as f:
                for line in f:
                    self.events.append(json.loads(line))
        except FileNotFoundError:
            pass

    def assign_variant(self, session_id):
        if hash(session_id) % 2 == 0:
            return "A"
        return "B"

    def modify_cta(self, base_cta, variant):
        if variant == "A":
            return f"🔥 {base_cta} วันนี้ รับโปรพิเศษ!"
        return f"💬 {base_cta} ฟรี! ไม่มีค่าใช้จ่าย"

    def analyze(self):
        stats = {"A": {"shown": 0, "clicked": 0, "booked": 0}, "B": {"shown": 0, "clicked": 0, "booked": 0}}
        session_variant = {}
        for e in self.events:
            sid = e["session_id"]
            if sid not in session_variant:
                session_variant[sid] = self.assign_variant(sid)
        for e in self.events:
            sid = e["session_id"]
            variant = session_variant.get(sid, "A")
            if e["event_type"] == "cta_shown": stats[variant]["shown"] += 1
            elif e["event_type"] == "cta_clicked": stats[variant]["clicked"] += 1
            elif e["event_type"] == "booking_completed": stats[variant]["booked"] += 1
        return stats

    def compute_results(self, stats):
        def safe(a, b): return a / b if b > 0 else 0
        results = {}
        for v in ["A", "B"]:
            results[v] = {
                "CTR": safe(stats[v]["clicked"], stats[v]["shown"]),
                "Conversion": safe(stats[v]["booked"], stats[v]["shown"]),
                "shown": stats[v]["shown"]
            }
        return results

    def print_report(self, results):
        print("\n" + "="*50)
        print("🧪 A/B TEST REPORT")
        print("="*50)
        for v, r in results.items():
            print(f"\nVariant {v}:")
            print(f"  Shown: {r['shown']}")
            print(f"  CTR: {round(r['CTR']*100,2)}%")
            print(f"  Conversion: {round(r['Conversion']*100,2)}%")
        winner = max(results.items(), key=lambda x: x[1]["Conversion"])
        print(f"\n🏆 Winner: Variant {winner[0]}")
        print("="*50)

if __name__ == "__main__":
    ab = ABTestManager()
    stats = ab.analyze()
    results = ab.compute_results(stats)
    ab.print_report(results)
