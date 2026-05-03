
from __future__ import annotations
from datetime import datetime
from typing import Any, Dict

class MessageNormalizer:
    def normalize(self, payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        platform = context.get("source_platform")
        if platform == "line": return self._normalize_line(payload, context)
        elif platform == "instagram": return self._normalize_instagram(payload, context)
        elif platform == "facebook": return self._normalize_facebook(payload, context)
        elif platform == "tiktok": return self._normalize_tiktok(payload, context)
        elif platform == "web": return self._normalize_webchat(payload, context)
        else: raise ValueError(f"unsupported_platform:{platform}")

    def _normalize_line(self, payload, context):
        return self._build_event(context=context,
            external_user_id=payload.get("external_user_id") or payload.get("userId"),
            message_text=payload.get("message_text") or payload.get("text"),
            timestamp=payload.get("timestamp"))

    def _normalize_instagram(self, payload, context):
        return self._build_event(context=context,
            external_user_id=payload.get("external_user_id") or payload.get("sender_id"),
            message_text=payload.get("message_text") or payload.get("text"),
            timestamp=payload.get("timestamp"))

    def _normalize_facebook(self, payload, context):
        return self._build_event(context=context,
            external_user_id=payload.get("external_user_id") or payload.get("sender_id"),
            message_text=payload.get("message_text") or payload.get("text"),
            timestamp=payload.get("timestamp"))

    def _normalize_tiktok(self, payload, context):
        return self._build_event(context=context,
            external_user_id=payload.get("external_user_id") or payload.get("user_id"),
            message_text=payload.get("message_text") or payload.get("text"),
            timestamp=payload.get("timestamp"))

    def _normalize_webchat(self, payload, context):
        return self._build_event(context=context,
            external_user_id=payload.get("external_user_id") or payload.get("session_id"),
            message_text=payload.get("message_text"),
            timestamp=payload.get("timestamp"))

    def _build_event(self, *, context, external_user_id, message_text, timestamp):
        if not external_user_id: raise ValueError("missing_external_user_id")
        if not message_text: raise ValueError("missing_message_text")
        if not context.get("tenant_id"): raise ValueError("missing_tenant_id")
        if not context.get("clinic_id"): raise ValueError("missing_clinic_id")
        return {
            "tenant_id": context.get("tenant_id"),
            "clinic_id": context.get("clinic_id"),
            "branch_id": context.get("branch_id"),
            "source_platform": context.get("source_platform"),
            "source_type": context.get("source_type"),
            "external_user_id": str(external_user_id),
            "message_text": str(message_text),
            "timestamp": self._normalize_timestamp(timestamp),
            "line_access_token": context.get("line_access_token"),
            "line_channel_secret": context.get("line_channel_secret"),
        }

    def _normalize_timestamp(self, ts):
        if not ts: return datetime.utcnow().isoformat() + "Z"
        if isinstance(ts, (int, float)):
            return datetime.utcfromtimestamp(ts).isoformat() + "Z"
        return str(ts)
