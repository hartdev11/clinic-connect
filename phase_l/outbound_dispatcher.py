
from __future__ import annotations
from typing import Any, Dict, Optional
from line_adapter import LineAdapter
from instagram_adapter import InstagramAdapter
from facebook_adapter import FacebookAdapter
from tiktok_adapter import TikTokAdapter
from webchat_adapter import WebchatAdapter

class OutboundDispatcher:
    def __init__(self, *, line_adapter=None, instagram_adapter=None, facebook_adapter=None, tiktok_adapter=None, webchat_adapter=None):
        self.line_adapter = line_adapter or LineAdapter()
        self.instagram_adapter = instagram_adapter or InstagramAdapter()
        self.facebook_adapter = facebook_adapter or FacebookAdapter()
        self.tiktok_adapter = tiktok_adapter or TikTokAdapter()
        self.webchat_adapter = webchat_adapter or WebchatAdapter()

    def dispatch(self, response_package: Dict[str, Any], headers: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        errors = []
        for f in ["source_platform","external_user_id","reply_text"]:
            if not str(response_package.get(f,"")).strip(): errors.append(f"missing:{f}")
        if errors: return {"status":"error","errors":errors}
        platform = response_package["source_platform"]
        headers = headers or {}
        token_override = (
            headers.get("X-Line-Access-Token")
            or headers.get("x-line-access-token")
            or response_package.get("line_access_token")
        )
        try:
            if platform == "line": return self.line_adapter.send(response_package, access_token=token_override)
            elif platform == "instagram": return self.instagram_adapter.send(response_package)
            elif platform == "facebook": return self.facebook_adapter.send(response_package)
            elif platform == "tiktok": return self.tiktok_adapter.send(response_package)
            elif platform == "web": return self.webchat_adapter.send(response_package)
            else: return {"status":"error","errors":[f"unsupported_platform:{platform}"]}
        except Exception as e:
            return {"status":"error","errors":[f"dispatch_failed:{platform}:{e}"]}
