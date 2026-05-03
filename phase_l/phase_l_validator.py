
from __future__ import annotations
import sys
from message_normalizer import MessageNormalizer
from integration_manager import IntegrationManager
from outbound_dispatcher import OutboundDispatcher
from integration_store import IntegrationStore

def ok(msg): print("OK: " + msg)
def fail(msg, errors): print("FAIL: " + msg); errors.append(msg)

def test_message_normalizer(errors):
    print("\n=== TEST: message_normalizer ===")
    normalizer = MessageNormalizer()
    payload = {"external_user_id":"line_user_001","message_text":"อยากจอง botox วันนี้","timestamp":"2026-03-20T10:00:00Z"}
    context = {"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"line","source_type":"line_oa"}
    try:
        result = normalizer.normalize(payload, context)
    except Exception as e:
        fail(f"normalizer_exception:{e}", errors); return
    required = ["tenant_id","clinic_id","branch_id","source_platform","source_type","external_user_id","message_text","timestamp"]
    missing = [x for x in required if x not in result]
    if missing: fail(f"normalizer_missing:{missing}", errors); return
    ok("message_normalizer passed")

def test_integration_manager(errors):
    print("\n=== TEST: integration_manager ===")
    manager = IntegrationManager(runtime_api_url="http://localhost:5000/inbound")
    canonical_event = {"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","source_platform":"line","source_type":"line_oa","external_user_id":"line_user_001","message_text":"อยากจอง botox วันนี้ ราคาเท่าไหร่","timestamp":"2026-03-20T10:00:00Z"}
    result = manager.process_inbound_event(canonical_event)
    if result.get("status") != "ok": fail("integration_manager_failed", errors); return
    pkg = result.get("response_package", {})
    if not pkg.get("reply_text"): fail("integration_manager_missing_reply", errors); return
    ok("integration_manager passed")

def test_outbound_dispatcher(errors):
    print("\n=== TEST: outbound_dispatcher ===")
    dispatcher = OutboundDispatcher()
    pkg = {"status":"ok","source_platform":"line","source_type":"line_oa","external_user_id":"line_user_001","reply_text":"แนะนำ: Botox ลดกราม\nราคาเริ่มต้น: 7999 บาท","cta_strategy":"price_and_close","handoff_required":False,"handoff_target":None,"booking_status":"pending_confirmation","procedure_id":"proc_021","service_name":"Botox ลดกราม","quoted_price":7999,"promotion_text":"ลด 20%","raw_runtime_response":{}}
    result = dispatcher.dispatch(pkg)
    if result.get("status") != "ok": fail("dispatcher_failed", errors); return
    if result.get("delivery_status") not in ("mock_sent","sent"): fail("dispatcher_bad_delivery_status", errors); return
    ok("outbound_dispatcher passed")

def test_adapters(errors):
    print("\n=== TEST: adapters ===")
    dispatcher = OutboundDispatcher()
    for platform, source_type, user_id in [("instagram","instagram_dm","ig_user_001"),("facebook","facebook_messenger","fb_user_001"),("tiktok","tiktok_dm","tt_user_001"),("web","web_chat","web_session_001")]:
        pkg = {"status":"ok","source_platform":platform,"source_type":source_type,"external_user_id":user_id,"reply_text":f"test reply for {platform}","cta_strategy":"soft_consultation","handoff_required":False,"handoff_target":None,"booking_status":None,"procedure_id":None,"service_name":None,"quoted_price":None,"promotion_text":None,"raw_runtime_response":{}}
        result = dispatcher.dispatch(pkg)
        if result.get("status") != "ok": fail(f"{platform}_adapter_failed", errors)
        else: ok(f"{platform}_adapter passed")

def test_integration_store(errors):
    print("\n=== TEST: integration_store ===")
    store = IntegrationStore()
    record = store.write_log(log_type="inbound",payload={"message_text":"test"},status="ok",timestamp="2026-03-20T10:00:00Z",message="validator test",tenant_id="t_001",clinic_id="c_001",branch_id="b_001",source_platform="line",source_type="line_oa",external_user_id="line_user_001",session_id="sess_test",event_id="evt_test")
    if not record.get("log_id"): fail("store_missing_log_id", errors); return
    if not store.list_by_platform("line"): fail("store_query_failed", errors); return
    ok("integration_store passed")

def main():
    print("PHASE L VALIDATOR")
    print("need: sales_runtime_api.py running\n")
    errors = []
    test_message_normalizer(errors)
    test_integration_manager(errors)
    test_outbound_dispatcher(errors)
    test_adapters(errors)
    test_integration_store(errors)
    print("\n========================")
    if errors:
        print("FINAL RESULT: FAIL")
        for e in errors: print(" - " + e)
        sys.exit(1)
    print("FINAL RESULT: PASS — PHASE L MODULES READY")

if __name__ == "__main__":
    main()
