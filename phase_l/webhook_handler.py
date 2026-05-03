
from __future__ import annotations
from flask import Flask, request, jsonify
from integration_manager import IntegrationManager
from message_normalizer import MessageNormalizer

app = Flask(__name__)
normalizer = MessageNormalizer()
integration_manager = IntegrationManager(runtime_api_url="http://localhost:5000/inbound")

def build_context(*, source_platform, source_type=None):
    payload = request.json or {}
    tenant_id = request.headers.get("X-Tenant-Id") or payload.get("tenant_id")
    clinic_id = request.headers.get("X-Clinic-Id") or payload.get("clinic_id")
    branch_id = request.headers.get("X-Branch-Id") or payload.get("branch_id") or clinic_id
    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "branch_id": branch_id,
        "partner_id": request.headers.get("X-Partner-Id") or payload.get("partner_id"),
        "campaign_id": request.headers.get("X-Campaign-Id") or payload.get("campaign_id"),
        "affiliate_id": request.headers.get("X-Affiliate-Id") or payload.get("affiliate_id"),
        "line_access_token": request.headers.get("X-Line-Access-Token") or payload.get("line_access_token"),
        "line_channel_secret": request.headers.get("X-Line-Channel-Secret") or payload.get("line_channel_secret"),
        "source_platform": source_platform,
        "source_type": source_type or payload.get("source_type"),
    }

def process_platform_payload(*, payload, context):
    try:
        canonical_event = normalizer.normalize(payload=payload, context=context)
    except Exception as e:
        return {"status":"error","stage":"normalize","error":str(e)}, 400
    try:
        result = integration_manager.process_inbound_event(canonical_event)
    except Exception as e:
        return {"status":"error","stage":"integration_manager","error":str(e)}, 500
    return result, (200 if result.get("status")=="ok" else 500)

@app.route("/health", methods=["GET"])
def health(): return jsonify({"status":"ok"}), 200

@app.route("/webhook/line", methods=["POST"])
def webhook_line():
    payload = request.json or {}
    context = build_context(source_platform="line", source_type="line_oa")
    events = payload.get("events") or []
    if not isinstance(events, list) or len(events) == 0:
        result, code = process_platform_payload(payload=payload, context=context)
        return jsonify(result), code

    processed = 0
    failed = 0
    errors = []
    for ev in events:
        if not isinstance(ev, dict):
            continue
        if ev.get("type") != "message":
            continue
        msg = ev.get("message") or {}
        if msg.get("type") != "text":
            continue
        normalized_payload = {
            "external_user_id": ((ev.get("source") or {}).get("userId") or ""),
            "message_text": (msg.get("text") or ""),
            "timestamp": ev.get("timestamp"),
            "line_access_token": context.get("line_access_token"),
        }
        result, code = process_platform_payload(payload=normalized_payload, context=context)
        if code == 200:
            processed += 1
        else:
            failed += 1
            errors.append(result)

    return jsonify({
        "status": "ok" if failed == 0 else "partial",
        "processed": processed,
        "failed": failed,
        "errors": errors[:3],
    }), 200

@app.route("/webhook/instagram", methods=["POST"])
def webhook_instagram():
    payload = request.json or {}
    context = build_context(source_platform="instagram", source_type=payload.get("source_type") or "instagram_dm")
    result, code = process_platform_payload(payload=payload, context=context)
    return jsonify(result), code

@app.route("/webhook/facebook", methods=["POST"])
def webhook_facebook():
    payload = request.json or {}
    context = build_context(source_platform="facebook", source_type=payload.get("source_type") or "facebook_messenger")
    result, code = process_platform_payload(payload=payload, context=context)
    return jsonify(result), code

@app.route("/webhook/tiktok", methods=["POST"])
def webhook_tiktok():
    payload = request.json or {}
    context = build_context(source_platform="tiktok", source_type=payload.get("source_type") or "tiktok_dm")
    result, code = process_platform_payload(payload=payload, context=context)
    return jsonify(result), code

@app.route("/webhook/webchat", methods=["POST"])
def webhook_webchat():
    payload = request.json or {}
    context = build_context(source_platform="web", source_type=payload.get("source_type") or "web_chat")
    result, code = process_platform_payload(payload=payload, context=context)
    return jsonify(result), code

if __name__ == "__main__":
    print("Webhook Handler running on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=True)
