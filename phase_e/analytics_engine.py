
import json
from collections import Counter, defaultdict

class AnalyticsEngine:
    def __init__(self, log_file="./logs/events.jsonl"):
        self.log_file = log_file
        self.events = []
        self._load_events()

    def _load_events(self):
        with open(self.log_file, encoding="utf-8") as f:
            for line in f:
                self.events.append(json.loads(line))

    def compute_funnel(self):
        funnel = Counter()
        for e in self.events:
            etype = e["event_type"]
            if etype == "user_input": funnel["input"] += 1
            elif etype == "cta_shown": funnel["cta_shown"] += 1
            elif etype == "cta_clicked": funnel["cta_clicked"] += 1
            elif etype == "procedure_viewed": funnel["viewed"] += 1
            elif etype == "procedure_selected": funnel["selected"] += 1
            elif etype == "booking_started": funnel["started"] += 1
            elif etype == "booking_completed": funnel["completed"] += 1
        return funnel

    def compute_conversion_rates(self, funnel):
        def safe_div(a, b): return a / b if b > 0 else 0
        return {
            "CTR": safe_div(funnel["cta_clicked"], funnel["cta_shown"]),
            "View Rate": safe_div(funnel["viewed"], funnel["cta_clicked"]),
            "Select Rate": safe_div(funnel["selected"], funnel["viewed"]),
            "Conversion Rate": safe_div(funnel["completed"], funnel["input"])
        }

    def top_procedures(self):
        proc_counter = Counter()
        for e in self.events:
            if e["event_type"] == "booking_completed":
                proc = e["data"]["procedure_id"]
                proc_counter[proc] += 1
        return proc_counter.most_common(10)

    def revenue_summary(self):
        total = 0
        for e in self.events:
            if e["event_type"] == "booking_completed":
                total += e["data"].get("revenue_estimate", 0)
        return total

    def procedure_performance(self):
        stats = defaultdict(lambda: {"views": 0, "bookings": 0})
        for e in self.events:
            if e["event_type"] == "procedure_viewed":
                stats[e["data"]["procedure_id"]]["views"] += 1
            if e["event_type"] == "booking_completed":
                stats[e["data"]["procedure_id"]]["bookings"] += 1
        performance = []
        for proc, s in stats.items():
            rate = s["bookings"] / max(s["views"], 1)
            performance.append((proc, rate, s))
        performance.sort(key=lambda x: x[1], reverse=True)
        return performance[:10]

    def generate_report(self):
        funnel = self.compute_funnel()
        rates = self.compute_conversion_rates(funnel)
        return {
            "funnel": dict(funnel),
            "rates": rates,
            "top_procedures": self.top_procedures(),
            "revenue": self.revenue_summary(),
            "best_converting_procedures": self.procedure_performance()
        }

    def print_report(self, report):
        print("\n" + "="*50)
        print("📊 ANALYTICS REPORT")
        print("="*50)
        print("\n🔥 Funnel:")
        for k, v in report["funnel"].items():
            print(f"  {k}: {v}")
        print("\n📈 Rates:")
        for k, v in report["rates"].items():
            print(f"  {k}: {round(v*100,2)}%")
        print("\n🏆 Top Procedures:")
        for proc, count in report["top_procedures"]:
            print(f"  {proc}: {count}")
        print(f"\n💰 Revenue: {report['revenue']}")
        print("="*50)

if __name__ == "__main__":
    engine = AnalyticsEngine()
    report = engine.generate_report()
    engine.print_report(report)
