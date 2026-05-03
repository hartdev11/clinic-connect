
import json, subprocess, sys, time, requests

OWNER_API = "http://localhost:7000/dashboard/owner"
CLINIC_API = "http://localhost:7000/dashboard/clinic"
BRANCH_API = "http://localhost:7000/dashboard/branch"
AFFILIATE_API = "http://localhost:7000/dashboard/affiliate"
AGENT_API = "http://localhost:7000/dashboard/agent"

def run_script(name):
    print(f"\nRunning {name} ...")
    result = subprocess.run(["python3", name])
    if result.returncode != 0:
        print(f"FAIL: {name}")
        sys.exit(1)
    print(f"OK: {name} DONE")

def fetch_dashboard(url, output_file, label):
    print(f"\nChecking {label} ...")
    for _ in range(8):
        try:
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                with open(output_file, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"OK: {label} → {output_file}")
                return data
        except Exception: pass
        time.sleep(1)
    print(f"FAIL: {label} not responding")
    sys.exit(1)

def validate_file(path):
    result = subprocess.run(["python3", "dashboard_validator.py", path])
    return result.returncode == 0

def sanity_check(data, role):
    errors = []
    ov = data.get("overview", {})
    funnel = data.get("funnel", {})
    if ov.get("total_revenue", 0) <= 0: errors.append(f"{role}:revenue_must_be_positive")
    if not (0 <= ov.get("ctr",0) <= 1): errors.append(f"{role}:ctr_invalid")
    if not (0 <= ov.get("conversion_rate",0) <= 1): errors.append(f"{role}:conversion_invalid")
    if not (funnel.get("view",0) >= funnel.get("click",0) >= funnel.get("booking",0)): errors.append(f"{role}:invalid_funnel")
    if not data.get("top_procedures"): errors.append(f"{role}:top_procedures_empty")
    if not data.get("trend",{}).get("daily"): errors.append(f"{role}:trend_daily_empty")
    if data.get("meta",{}).get("role") != role: errors.append(f"{role}:meta_role_mismatch")
    if role == "owner":
        if not data.get("affiliate",{}).get("enabled"): errors.append("owner:affiliate_not_enabled")
        if not data.get("agent",{}).get("enabled"): errors.append("owner:agent_not_enabled")
        if not data.get("branch_performance",{}).get("enabled"): errors.append("owner:branch_not_enabled")
    if role == "affiliate" and not data.get("affiliate",{}).get("enabled"): errors.append("affiliate:not_enabled")
    if role == "agent" and not data.get("agent",{}).get("enabled"): errors.append("agent:not_enabled")
    if role == "branch" and not data.get("branch_performance",{}).get("enabled"): errors.append("branch:not_enabled")
    return errors

def main():
    print("PHASE K FINAL CHECK\n")
    print("need: dashboard_api.py running\n")
    run_script("dashboard_mock_data.py")
    run_script("metrics_aggregator.py")
    run_script("analytics_engine_v2.py")
    run_script("insight_engine.py")

    owner = fetch_dashboard(OWNER_API, "sample_dashboard_owner.json", "owner")
    clinic = fetch_dashboard(CLINIC_API, "sample_dashboard_clinic.json", "clinic")
    branch = fetch_dashboard(BRANCH_API, "sample_dashboard_branch.json", "branch")
    affiliate = fetch_dashboard(AFFILIATE_API, "sample_dashboard_affiliate.json", "affiliate")
    agent = fetch_dashboard(AGENT_API, "sample_dashboard_agent.json", "agent")

    print("\nRunning validators ...")
    all_errors = []
    for role, path in [("owner","sample_dashboard_owner.json"),("clinic","sample_dashboard_clinic.json"),("branch","sample_dashboard_branch.json"),("affiliate","sample_dashboard_affiliate.json"),("agent","sample_dashboard_agent.json")]:
        if validate_file(path): print(f"OK: validator passed: {role}")
        else: print(f"FAIL: validator failed: {role}"); all_errors.append(f"validator_failed:{role}")

    all_errors.extend(sanity_check(owner, "owner"))
    all_errors.extend(sanity_check(clinic, "clinic"))
    all_errors.extend(sanity_check(branch, "branch"))
    all_errors.extend(sanity_check(affiliate, "affiliate"))
    all_errors.extend(sanity_check(agent, "agent"))

    print("\n========================")
    if all_errors:
        print("FINAL RESULT: FAIL\n")
        for e in all_errors: print(" -", e)
        sys.exit(1)
    print("FINAL RESULT: PASS — PHASE K FULLY COMPLETE")

if __name__ == "__main__":
    main()
