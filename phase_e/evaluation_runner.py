
import os
from simulate_users import run_simulation
from analytics_engine import AnalyticsEngine
from optimizer import Optimizer

def clear_logs():
    if os.path.exists("./logs/events.jsonl"):
        os.remove("./logs/events.jsonl")
        print("🧹 Cleared old logs")

def run_full_cycle(n_users=1000):
    print("\n" + "="*60)
    print("🚀 STARTING FULL EVALUATION CYCLE")
    print("="*60)
    clear_logs()
    print("\n👤 Running user simulation...")
    run_simulation(n_users)
    print("\n📊 Running analytics...")
    engine = AnalyticsEngine()
    report = engine.generate_report()
    engine.print_report(report)
    print("\n🧠 Running optimizer...")
    optimizer = Optimizer()
    weights = optimizer.run()
    print("\n🏆 Top optimized procedures:")
    for proc, data in sorted(weights.items(), key=lambda x: x[1]["weight"], reverse=True)[:10]:
        print(f"{proc}: weight={data['weight']}")
    print("\n" + "="*60)
    print("✅ FULL CYCLE COMPLETE")
    print("="*60)

if __name__ == "__main__":
    run_full_cycle(n_users=1000)
