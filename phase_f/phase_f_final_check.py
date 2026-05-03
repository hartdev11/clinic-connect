
import json
import sys

def run_script(name):
    import subprocess
    print(f"\n🚀 Running {name}")
    result = subprocess.run(["python3", name])
    if result.returncode != 0:
        print(f"❌ {name} FAILED")
        return False
    print(f"✅ {name} DONE")
    return True

def sanity_check(data):
    print("\n🧠 Sanity Check...")
    errors = []
    overview = data.get("overview", {})
    funnel = data.get("funnel", {})
    insights = data.get("insights", [])
    if overview.get("conversion_rate", 0) <= 0: errors.append("Conversion = 0")
    if overview.get("total_revenue", 0) <= 0: errors.append("Revenue = 0")
    if not (funnel.get("view", 0) >= funnel.get("click", 0) >= funnel.get("booking", 0)):
        errors.append("Funnel invalid")
    if not insights: errors.append("No insights")
    if not data.get("trend", {}).get("daily"): errors.append("No trend data")
    return errors

def main():
    print("🔍 PHASE F FINAL CHECK\n")

    if not run_script("metrics_aggregator.py"): sys.exit(1)
    if not run_script("analytics_engine.py"): sys.exit(1)
    if not run_script("insight_engine.py"): sys.exit(1)
    if not run_script("dashboard_api.py"): sys.exit(1)
    if not run_script("dashboard_validator_v2.py"): sys.exit(1)

    print("\n🧠 Loading dashboard output...")
    with open("dashboard_output.json", encoding="utf-8") as f:
        data = json.load(f)

    errors = sanity_check(data)

    print("\n======================")
    if errors:
        print("❌ FINAL RESULT: FAIL")
        for e in errors: print(" -", e)
        sys.exit(1)
    else:
        print("🎉 FINAL RESULT: PASS — PHASE F COMPLETE")

if __name__ == "__main__":
    main()
