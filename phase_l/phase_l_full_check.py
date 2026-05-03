
from __future__ import annotations
import sys
import requests

WEBHOOK_BASE = "http://localhost:8000"
RUNTIME_HEALTH = "http://localhost:5000/health"

def ok(msg): print("OK: " + msg)
def fail(msg, errors): print("FAIL: " + msg); errors.append(msg)

def check_runtime_health(errors):
    print("\n=== CHECK: sales runtime health ===")
    try:
        res = requests.get(RUNTIME_HEALTH, timeout=5)
        data = res.json() if res.status_code == 200 else None
    except Exception as e: fail(f"runtime_unreachable:{e}", errors); return
    if not data or data.get("status") != "ok": fail("runtime_health_not_ok", errors); return
    ok("sales runtime health passed")

def check_webhook_health(errors):
    print("\n=== CHECK: webhook handler health ===")
    try:
        res = requests.get(f"{WEBHOOK_BASE}/health", timeout=5)
        data = res.json() if res.status_code == 200 else None
    except Exception as e: fail(f"webhook_unreachable:{e}", errors); return
    if not data or data.get("status") != "ok": fail("webhook_health_not_ok", errors); return
    ok("webhook handler health passed")

def post_and_validate(*, route, payload, label, errors):
    print(f"\n=== TEST: {label} ===")
    try:
        res = requests.post(f"{WEBHOOK_BASE}{route}", json=payload, timeout=10)
    except Exception as e: fail(f"{label}_request_failed:{e}", errors); return
    if res.status_code != 200: fail(f"{label}_bad_status:{res.status_code}", errors); return
    try: data = res.json()
    except Exception: fail(f"{label}_invalid_json", errors); return
    if data.get("status") != "ok": fail(f"{label}_status_not_ok", errors); return
    pkg = data.get("response_package", {})
    if not pkg: fail(f"{label}_missing_response_package", errors); return
    if not pkg.get("reply_text"): fail(f"{label}_missing_reply_text", errors); return
    if pkg.get("source_platform") != payload.get("source_platform"): fail(f"{label}_platform_mismatch", errors); return
    ok(f"{label} passed")

def main():
    print("PHASE L FULL CHECK\n")
    print("need: sales_runtime_api.py + webhook_handler.py running\n")
    errors = []
    check_runtime_health(errors)
    check_webhook_health(errors)
    post_and_validate(route="/webhook/line",label="line_webhook_flow",payload={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"line","source_type":"line_oa","external_user_id":"line_user_001","message_text":"อยากจอง botox วันนี้","timestamp":"2026-03-20T10:00:00Z"},errors=errors)
    post_and_validate(route="/webhook/instagram",label="instagram_webhook_flow",payload={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"instagram","source_type":"instagram_dm","external_user_id":"ig_user_001","message_text":"botox ราคาเท่าไหร่","timestamp":"2026-03-20T10:05:00Z"},errors=errors)
    post_and_validate(route="/webhook/facebook",label="facebook_webhook_flow",payload={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"facebook","source_type":"facebook_messenger","external_user_id":"fb_user_001","message_text":"มีโปร filler ไหม","timestamp":"2026-03-20T10:10:00Z"},errors=errors)
    post_and_validate(route="/webhook/tiktok",label="tiktok_webhook_flow",payload={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"tiktok","source_type":"tiktok_dm","external_user_id":"tt_user_001","message_text":"อยากหน้าเรียวทำอะไรดี","timestamp":"2026-03-20T10:15:00Z"},errors=errors)
    post_and_validate(route="/webhook/webchat",label="webchat_flow",payload={"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"web","source_type":"web_chat","external_user_id":"web_session_001","message_text":"สนใจ ulthera ขอข้อมูลหน่อย","timestamp":"2026-03-20T10:20:00Z"},errors=errors)
    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL")
        for e in errors: print(" - " + e)
        sys.exit(1)
    print("FINAL RESULT: PASS — PHASE L FULLY COMPLETE")

if __name__ == "__main__":
    main()
