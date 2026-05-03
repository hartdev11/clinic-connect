
import time
from simulate_users import run_simulation
from analytics_engine import AnalyticsEngine
from optimizer import Optimizer
from update_weights import WeightManager

class AutoTrainer:
    def __init__(self, cycles=5, users_per_cycle=1000, delay=2):
        self.cycles = cycles
        self.users_per_cycle = users_per_cycle
        self.delay = delay

    def run_cycle(self, cycle_num):
        print("\n" + "="*60)
        print(f"🔁 CYCLE {cycle_num}")
        print("="*60)
        print("\n👤 Simulating users...")
        run_simulation(self.users_per_cycle)
        print("\n📊 Analyzing data...")
        engine = AnalyticsEngine()
        report = engine.generate_report()
        engine.print_report(report)
        print("\n🧠 Optimizing...")
        optimizer = Optimizer()
        weights = optimizer.run()
        print("\n⚙️ Updating weights...")
        wm = WeightManager()
        print("Weights loaded:", len(wm.weights))
        print("\n🏆 Top Procedures After Optimization:")
        for proc, data in sorted(weights.items(), key=lambda x: x[1]["weight"], reverse=True)[:5]:
            print(f"{proc}: weight={data['weight']}")
        print("\n✅ Cycle complete")

    def run(self):
        print("\n" + "="*60)
        print("🚀 STARTING AUTO TRAINING")
        print("="*60)
        for i in range(1, self.cycles + 1):
            self.run_cycle(i)
            if i < self.cycles:
                print(f"\n⏳ Waiting {self.delay} sec...")
                time.sleep(self.delay)
        print("\n" + "="*60)
        print("🔥 AUTO TRAINING COMPLETE")
        print("="*60)

if __name__ == "__main__":
    trainer = AutoTrainer(cycles=5, users_per_cycle=1000, delay=1)
    trainer.run()
