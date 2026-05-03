
from __future__ import annotations
from typing import Any, Dict, List, Optional

class WebchatAdapter:
    def __init__(self, *, mock_mode=True):
        self.mock_mode = mock_mode

    def send(self, response_package: Dict[str, Any]) -> Dict[str, Any]:
        errors = []
        for f in ["external_user_id","reply_text"]:
            if not str(response_package.get(f,"")).strip(): errors.append(f"missing:{f}")
        if response_package.get("source_platform") != "web": errors.append("invalid_platform")
        if errors: return {"status":"error","platform":"web","errors":errors}
        payload = {
            "session_id": response_package["external_user_id"],
            "message": {"type":"text","text":response_package["reply_text"]},
            "meta": {
                "cta_strategy": response_package.get("cta_strategy"),
                "handoff_required": response_package.get("handoff_required", False),
                "handoff_target": response_package.get("handoff_target"),
                "booking_status": response_package.get("booking_status"),
                "procedure_id": response_package.get("procedure_id"),
                "service_name": response_package.get("service_name"),
                "quoted_price": response_package.get("quoted_price"),
                "promotion_text": response_package.get("promotion_text"),
            }
        }
        return {"status":"ok","platform":"web","delivery_status":"mock_sent" if self.mock_mode else "sent","external_user_id":response_package["external_user_id"],"outbound_payload":payload}
