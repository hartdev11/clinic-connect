
from __future__ import annotations
import requests
import sys
from affiliate_signup_engine import AffiliateSignupEngine
from affiliate_link_manager import AffiliateLinkManager
from affiliate_click_tracker import AffiliateClickTracker
from sales_agent_manager import SalesAgentManager
from partner_white_label_manager import PartnerWhiteLabelManager

API_URL = "http://localhost:5000/inbound"

def ok(msg): print("OK: " + msg)
def fail(msg, errors): print("FAIL: " + msg); errors.append(msg)

def test_sales_runtime(errors):
    print("\n=== TEST 1: SALES RUNTIME ===")
    payload = {"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"line","source_type":"line_oa","external_user_id":"user_pg_001","message_text":"อยากจอง botox วันนี้ ราคาเท่าไหร่","timestamp":"2026-03-20T10:00:00Z"}
    try:
        res = requests.post(API_URL, json=payload, timeout=10)
        data = res.json() if res.status_code == 200 else None
    except Exception as e:
        fail("api_unreachable:" + str(e), errors)
        return
    if not data or data.get("status") != "ok":
        fail("api_status_not_ok", errors)
        return
    if not data.get("lead"): fail("missing_lead", errors)
    if not data.get("offer", {}).get("procedure_id"): fail("missing_offer", errors)
    if "handoff_required" not in data.get("handoff", {}): fail("missing_handoff", errors)
    if not data.get("attribution", {}).get("attribution_id"): fail("missing_attribution", errors)
    ok("sales runtime passed")

def test_affiliate_flow(errors):
    print("\n=== TEST 2: AFFILIATE FLOW ===")
    engine = AffiliateSignupEngine()
    r = engine.signup({"tenant_id":"t_001","role_type":"affiliate","full_name":"PG Affiliate","email":"pg_aff@example.com","phone":"0812340001","payout_method":"promptpay","payout_account":"0812340001"})
    if r.get("status") != "ok": fail("affiliate_signup_failed", errors); return
    ok("affiliate signup passed")
    aff_id = r["account"]["affiliate_id"]
    r2 = engine.update_status(aff_id, "approved", note="auto_approve")
    if r2.get("status") != "ok": fail("affiliate_approve_failed", errors); return
    ok("affiliate approve passed")
    lm = AffiliateLinkManager(base_url="https://app.glow-ai.com")
    r3 = lm.create_link({"tenant_id":"t_001","affiliate_id":aff_id,"referral_code":r["account"]["referral_code"],"source_platform":"instagram","landing_path":"/clinic-register"})
    if r3.get("status") != "ok": fail("affiliate_link_failed", errors); return
    ok("affiliate link passed")
    ct = AffiliateClickTracker()
    r4 = ct.track_click({"affiliate_id":aff_id,"referral_code":r["account"]["referral_code"],"source_platform":"instagram","landing_path":"/clinic-register","visitor_id":"v_001","timestamp":"2026-03-20T10:00:00Z"}, link_record=r3["link"])
    if r4.get("status") != "ok": fail("affiliate_click_failed", errors); return
    ok("affiliate click passed")

def test_sales_agent(errors):
    print("\n=== TEST 3: SALES AGENT ===")
    manager = SalesAgentManager()
    r = manager.signup({"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","full_name":"PG Agent","email":"pg_agent@example.com","phone":"0890000001","role_type":"closer","commission_type":"percent","commission_value":0.05})
    if r.get("status") != "ok": fail("agent_signup_failed", errors); return
    ok("agent signup passed")
    r2 = manager.update_status(r["agent"]["agent_id"], "approved", note="auto_approve")
    if r2.get("status") != "ok": fail("agent_approve_failed", errors); return
    ok("agent approve passed")
    r3 = manager.record_performance(r["agent"]["agent_id"], lead_increment=5, booking_increment=1, revenue_increment=10000)
    if r3.get("status") != "ok": fail("agent_performance_failed", errors); return
    ok("agent performance passed")

def test_white_label(errors):
    print("\n=== TEST 4: WHITE LABEL ===")
    manager = PartnerWhiteLabelManager()
    r = manager.signup_partner({"company_name":"PG Partner","owner_name":"PG Owner","email":"pg_partner@example.com","phone":"0811110001","white_label_enabled":True,"brand_name":"PGOS","primary_color":"#111827","custom_domain":"portal.pgos.co","feature_flags":{"affiliate_module":True}})
    if r.get("status") != "ok": fail("wl_signup_failed", errors); return
    ok("white-label signup passed")
    partner_id = r["partner"]["partner_id"]
    r2 = manager.update_status(partner_id, "approved", note="auto_approve")
    if r2.get("status") != "ok": fail("wl_approve_failed", errors); return
    ok("white-label approve passed")
    r3 = manager.get_runtime_branding_context(partner_id)
    if r3.get("status") != "ok" or not r3.get("branding_context", {}).get("brand_name"):
        fail("wl_branding_failed", errors)
        return
    ok("white-label branding passed")

def main():
    print("PHASE G FULL VALIDATOR")
    errors = []
    test_sales_runtime(errors)
    test_affiliate_flow(errors)
    test_sales_agent(errors)
    test_white_label(errors)
    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL")
        for e in errors: print(" - " + e)
        sys.exit(1)
    print("FINAL RESULT: PASS — PHASE G FULLY COMPLETE")

if __name__ == "__main__":
    main()
