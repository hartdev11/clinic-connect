import subprocess
import sys

def run_script(name):
    print(f"\n🚀 Running {name} ...")
    result = subprocess.run(["python3", name])
    if result.returncode != 0:
        print(f"❌ {name} FAILED")
        sys.exit(1)
    print(f"✅ {name} DONE")

def main():
    print("🔍 RUN FULL DASHBOARD PIPELINE\n")
    run_script("metrics_aggregator.py")
    run_script("analytics_engine.py")
    run_script("insight_engine.py")
    run_script("dashboard_api.py")
    run_script("dashboard_validator_v2.py")
    print("\n==========================")
    print("🎉 FULL PIPELINE COMPLETE")

if __name__ == "__main__":
    main()
