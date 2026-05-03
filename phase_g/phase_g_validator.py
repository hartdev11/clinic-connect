
import requests
import sys

API_URL = "http://localhost:5000/inbound"

TEST_CASES = [
    {"name":"high_intent_booking","payload":{"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"line","source_type":"line_oa","external_user_id":"user_001","message_text":"จอง botox วันนี้เลยค่ะ","timestamp":"2026-03-20T10:00:00Z"}},
    {"name":"medium_intent_consult","payload":{"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"instagram","source_type":"instagram_dm","external_user_id":"user_002","message_text":"botox ดีไหม ราคาเท่าไหร่","timestamp":"2026-03-20T11:00:00Z"}},
    {"name":"low_intent_info","payload":{"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"web","source_type":"web_chat","external_user_id":"user_003","message_text":"มีโปรอะไรบ้าง","timestamp":"2026-03-20T12:00:00Z"}}
]

def call_api(payload):
    try:
        res = requests.post(API_URL, json=payload, timeout=10)
        return res.json() if res.status_code == 200 else None
    except: return None

def validate_response(data):
    if not data or data.get("status") != "ok": return ["Status not ok"]
    errors = []
    if not data.get("lead"): errors.append("Missing lead")
    if data.get("score",{}).get("score",0) <= 0: errors.append("Score invalid")
    if not data.get("offer",{}).get("procedure_id"): errors.append("No procedure")
    if "intent_detected" not in data.get("booking_intent",{}): errors.append("No booking_intent")
    if "handoff_required" not in data.get("handoff",{}): errors.append("No handoff")
    if not data.get("attribution",{}).get("attribution_id"): errors.append("No attribution")
    return errors

def main():
    print("🚀 PHASE G VALIDATOR
")
    all_errors = []
    for case in TEST_CASES:
        print(f"
🔎 Test: {case['name']}")
        data = call_api(case["payload"])
        errors = validate_response(data)
        if errors:
            print("❌ FAIL:")
            for e in errors: print(" -", e)
            all_errors.append(f"{case['name']} → {errors}")
        else:
            print("✅ PASS")
    print("
========================")
    if all_errors:
        print("❌ FINAL RESULT: FAIL")
        for e in all_errors: print(" -", e)
        sys.exit(1)
    else:
        print("🎉 FINAL RESULT: PASS — PHASE G READY FOR PRODUCTION 🚀")

if __name__ == "__main__":
    main()
