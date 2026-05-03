
from __future__ import annotations
from typing import Any, Dict, List, Optional

class FacebookAdapter:
    def __init__(self, *, access_token=None, mock_mode=True):
        self.access_token = access_token
        self.mock_mode = mock_mode

    def send(self, response_package: Dict[str, Any]) -> Dict[str, Any]:
        errors = []
        for f in ["external_user_id","reply_text"]:
            if not str(response_package.get(f,"")).strip(): errors.append(f"missing:{f}")
        if response_package.get("source_platform") != "facebook": errors.append("invalid_platform")
        if errors: return {"status":"error","platform":"facebook","errors":errors}
        text = response_package["reply_text"]
        cta = response_package.get("cta_strategy")
        if cta: text += f"\n\n[CTA] {cta}"
        payload = {"recipient":{"id":response_package["external_user_id"]},"message":{"text":text}}
        return {"status":"ok","platform":"facebook","delivery_status":"mock_sent" if self.mock_mode else "sent","external_user_id":response_package["external_user_id"],"outbound_payload":payload}
