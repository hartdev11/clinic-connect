
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from source_taxonomy import SourcePlatform, SourceType, SOURCE_CONTENT_TYPE

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def safe_str(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()

def pick_first_non_empty(*values: Any) -> str:
    for v in values:
        s = safe_str(v)
        if s:
            return s
    return ""

def normalize_timestamp(raw_ts: Any) -> str:
    ts = safe_str(raw_ts)
    if not ts:
        return utc_now_iso()
    if ts.isdigit():
        try:
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            return dt.isoformat().replace("+00:00", "Z")
        except Exception:
            return utc_now_iso()
    if "T" in ts:
        return ts.replace("+00:00", "Z")
    return utc_now_iso()

def build_base_event(*, tenant_id, clinic_id, branch_id, source_platform, source_type, external_user_id, message_text, timestamp=None, partner_id=None, campaign_id=None, affiliate_id=None, content_id=None):
    content_type = SOURCE_CONTENT_TYPE.get(SourceType(source_type)) if source_type in [e.value for e in SourceType] else None
    return {
        "tenant_id": tenant_id,
        "clinic_id": clinic_id,
        "branch_id": branch_id,
        "partner_id": partner_id,
        "source_platform": source_platform,
        "source_type": source_type,
        "external_user_id": external_user_id,
        "message_text": message_text,
        "timestamp": timestamp or utc_now_iso(),
        "campaign_id": campaign_id,
        "affiliate_id": affiliate_id,
        "content_id": content_id,
        "content_type": content_type.value if content_type else None,
    }

def normalize_line_payload(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    return build_base_event(
        tenant_id=safe_str(context.get("tenant_id")),
        clinic_id=safe_str(context.get("clinic_id")),
        branch_id=safe_str(context.get("branch_id")),
        partner_id=safe_str(context.get("partner_id")) or None,
        campaign_id=safe_str(context.get("campaign_id")) or None,
        affiliate_id=safe_str(context.get("affiliate_id")) or None,
        source_platform=SourcePlatform.LINE.value,
        source_type=SourceType.LINE_OA.value,
        external_user_id=pick_first_non_empty(payload.get("source", {}).get("userId"), payload.get("userId")),
        message_text=pick_first_non_empty(payload.get("message", {}).get("text"), payload.get("text")),
        timestamp=normalize_timestamp(payload.get("timestamp")),
        content_id=pick_first_non_empty(payload.get("message", {}).get("id"), payload.get("messageId")) or None,
    )

def normalize_web_payload(payload: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
    source_type = safe_str(context.get("source_type"), SourceType.WEB_CHAT.value)
    message_text = pick_first_non_empty(payload.get("message_text"), payload.get("message"), payload.get("question"))
    external_user_id = pick_first_non_empty(payload.get("visitor_id"), payload.get("session_id"), payload.get("email"))
    return build_base_event(
        tenant_id=safe_str(context.get("tenant_id")),
        clinic_id=safe_str(context.get("clinic_id")),
        branch_id=safe_str(context.get("branch_id")),
        partner_id=safe_str(context.get("partner_id")) or None,
        campaign_id=safe_str(context.get("campaign_id")) or None,
        affiliate_id=safe_str(context.get("affiliate_id")) or None,
        source_platform=SourcePlatform.WEB.value,
        source_type=source_type,
        external_user_id=external_user_id,
        message_text=message_text,
        timestamp=normalize_timestamp(payload.get("timestamp")),
        content_id=pick_first_non_empty(payload.get("form_id"), payload.get("session_id")) or None,
    )
