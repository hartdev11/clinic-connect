
from __future__ import annotations
import json
from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional
import requests

@dataclass
class IntegrationResponsePackage:
    status: str
    source_platform: str
    source_type: str
    external_user_id: str
    reply_text: str
    cta_strategy: Optional[str]
    handoff_required: bool
    handoff_target: Optional[str]
    booking_status: Optional[str]
    procedure_id: Optional[str]
    service_name: Optional[str]
    quoted_price: Optional[float]
    promotion_text: Optional[str]
    raw_runtime_response: Dict[str, Any]

class IntegrationManager:
    def __init__(self, runtime_api_url="http://localhost:5000/inbound", timeout_seconds=15):
        self.runtime_api_url = runtime_api_url
        self.timeout_seconds = timeout_seconds

    def process_inbound_event(self, canonical_event):
        errors = self._validate(canonical_event)
        if errors: return {"status":"error","errors":errors}
        runtime_response = self._call_runtime(canonical_event)
        if runtime_response.get("status") != "ok":
            return {"status":"error","errors":["runtime_call_failed"],"runtime_response":runtime_response}
        package = self._build_package(canonical_event, runtime_response)
        return {"status":"ok","response_package":asdict(package)}

    def _validate(self, event):
        required = ["tenant_id","clinic_id","branch_id","source_platform","source_type","external_user_id","message_text","timestamp"]
        return [f"missing:{f}" for f in required if not str(event.get(f,"")).strip()]

    def _call_runtime(self, canonical_event):
        try:
            res = requests.post(self.runtime_api_url, json=canonical_event, timeout=self.timeout_seconds)
        except Exception as e:
            return {"status":"error","error":f"runtime_unreachable:{e}"}
        if res.status_code != 200:
            return {"status":"error","error":f"bad_status:{res.status_code}"}
        try:
            data = res.json()
            return data if isinstance(data, dict) else {"status":"error","error":"not_dict"}
        except Exception:
            return {"status":"error","error":"invalid_json"}

    def _build_package(self, canonical_event, runtime_response):
        offer = runtime_response.get("offer") or {}
        handoff = runtime_response.get("handoff") or {}
        booking = runtime_response.get("booking") or {}
        booking_obj = booking.get("booking") if isinstance(booking, dict) else None
        reply_text = self._compose_reply(runtime_response)
        return IntegrationResponsePackage(
            status="ok",
            source_platform=canonical_event["source_platform"],
            source_type=canonical_event["source_type"],
            external_user_id=canonical_event["external_user_id"],
            reply_text=reply_text,
            cta_strategy=offer.get("cta"),
            handoff_required=bool(handoff.get("handoff_required", False)),
            handoff_target=handoff.get("handoff_target"),
            booking_status=(booking_obj or {}).get("booking_status"),
            procedure_id=offer.get("procedure_id"),
            service_name=offer.get("service_name"),
            quoted_price=offer.get("price"),
            promotion_text=offer.get("promotion"),
            raw_runtime_response=runtime_response,
        )

    def _compose_reply(self, runtime_response):
        offer = runtime_response.get("offer") or {}
        handoff = runtime_response.get("handoff") or {}
        booking_intent = runtime_response.get("booking_intent") or {}
        if handoff.get("handoff_required"):
            target = handoff.get("handoff_target") or "เจ้าหน้าที่"
            return f"ขออนุญาตส่งต่อเคสนี้ให้ {target} ดูแลต่อให้นะครับ"
        lines = []
        if offer.get("service_name"): lines.append(f"แนะนำ: {offer['service_name']}")
        if offer.get("price"): lines.append(f"ราคาเริ่มต้น: {offer['price']} บาท")
        if offer.get("promotion"): lines.append(f"โปรโมชั่น: {offer['promotion']}")
        action = booking_intent.get("next_action")
        if action == "confirm_booking_slot": lines.append("สามารถยืนยันวันและช่วงเวลาเพื่อจองคิวได้เลยครับ")
        elif action == "request_time_slot": lines.append("สะดวกวันและช่วงเวลาไหน แจ้งได้เลยครับ")
        elif action == "push_booking_confirmation": lines.append("หากต้องการจอง แจ้งได้เลยครับ")
        else: lines.append("หากสนใจข้อมูลเพิ่มเติม แจ้งได้เลยครับ")
        return "\n".join(lines) if lines else "ขอบคุณสำหรับข้อความครับ"
