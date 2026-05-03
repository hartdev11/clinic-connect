
import subprocess, sys, time, requests, json

API_URL = "http://localhost:7000/dashboard/owner"
SAMPLE_FILE = "sample_dashboard.json"

def run_script(name):
    print(f"\nRunning {name} ...")
    result = subprocess.run(["python3", name])
    if result.returncode != 0:
        print(f"FAIL: {name}")
        sys.exit(1)
    print(f"OK: {name} DONE")

def check_api():
    print("\nChecking dashboard API...")
    for _ in range(8):
        try:
            res = requests.get(API_URL, timeout=5)
            if res.status_code == 200:
                data = res.json()
                with open(SAMPLE_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"OK: Dashboard API → saved to {SAMPLE_FILE}")
                return
        except Exception: pass
        print("waiting dashboard API...")
        time.sleep(1)
    print("FAIL: dashboard API not responding")
    sys.exit(1)

def main():
    print("RUN PHASE K DASHBOARD CHECKS\n")
    run_script("dashboard_mock_data.py")
    run_script("metrics_aggregator.py")
    run_script("analytics_engine_v2.py")
    run_script("insight_engine.py")
    print("\nMake sure dashboard_api.py is running\n")
    check_api()
    run_script("dashboard_validator.py")
    print("\n==========================")
    print("PHASE K PIPELINE COMPLETE")

if __name__ == "__main__":
    main()
