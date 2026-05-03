
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Set

class SourcePlatform(str, Enum):
    LINE = "line"
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TIKTOK = "tiktok"
    WEB = "web"
    ADS = "ads"

class SourceType(str, Enum):
    LINE_OA = "line_oa"
    INSTAGRAM_DM = "instagram_dm"
    INSTAGRAM_COMMENT = "instagram_comment"
    INSTAGRAM_REEL_COMMENT = "instagram_reel_comment"
    INSTAGRAM_STORY_REPLY = "instagram_story_reply"
    FACEBOOK_MESSENGER = "facebook_messenger"
    FACEBOOK_COMMENT = "facebook_comment"
    FACEBOOK_REEL_COMMENT = "facebook_reel_comment"
    TIKTOK_DM = "tiktok_dm"
    TIKTOK_COMMENT = "tiktok_comment"
    TIKTOK_VIDEO_COMMENT = "tiktok_video_comment"
    WEB_CHAT = "web_chat"
    WEB_FORM = "web_form"
    LANDING_PAGE_FORM = "landing_page_form"
    FACEBOOK_AD_LEAD = "facebook_ad_lead"
    TIKTOK_AD_LEAD = "tiktok_ad_lead"
    GOOGLE_AD_LEAD = "google_ad_lead"

class ContentType(str, Enum):
    MESSAGE = "message"
    COMMENT = "comment"
    REPLY = "reply"
    FORM = "form"
    LEAD = "lead"

class LeadEventType(str, Enum):
    LEAD_CREATED = "lead_created"
    MESSAGE_RECEIVED = "message_received"
    MESSAGE_SENT = "message_sent"
    RECOMMENDATION_SHOWN = "recommendation_shown"
    CTA_SHOWN = "cta_shown"
    CTA_CLICKED = "cta_clicked"
    BOOKING_INTENT_CREATED = "booking_intent_created"
    BOOKING_CREATED = "booking_created"
    HANDOFF_TRIGGERED = "handoff_triggered"
    LEAD_STAGE_UPDATED = "lead_stage_updated"

class LeadStage(str, Enum):
    NEW_LEAD = "new_lead"
    ENGAGED = "engaged"
    INTERESTED = "interested"
    RECOMMENDED = "recommended"
    PRICING_SENT = "pricing_sent"
    BOOKING_INTENT = "booking_intent"
    BOOKED = "booked"
    LOST = "lost"
    HANDOFF = "handoff"

PLATFORM_SOURCE_TYPES: Dict[SourcePlatform, Set[SourceType]] = {
    SourcePlatform.LINE: {SourceType.LINE_OA},
    SourcePlatform.INSTAGRAM: {SourceType.INSTAGRAM_DM, SourceType.INSTAGRAM_COMMENT, SourceType.INSTAGRAM_REEL_COMMENT, SourceType.INSTAGRAM_STORY_REPLY},
    SourcePlatform.FACEBOOK: {SourceType.FACEBOOK_MESSENGER, SourceType.FACEBOOK_COMMENT, SourceType.FACEBOOK_REEL_COMMENT, SourceType.FACEBOOK_AD_LEAD},
    SourcePlatform.TIKTOK: {SourceType.TIKTOK_DM, SourceType.TIKTOK_COMMENT, SourceType.TIKTOK_VIDEO_COMMENT, SourceType.TIKTOK_AD_LEAD},
    SourcePlatform.WEB: {SourceType.WEB_CHAT, SourceType.WEB_FORM, SourceType.LANDING_PAGE_FORM},
    SourcePlatform.ADS: {SourceType.FACEBOOK_AD_LEAD, SourceType.TIKTOK_AD_LEAD, SourceType.GOOGLE_AD_LEAD},
}

SOURCE_CONTENT_TYPE: Dict[SourceType, ContentType] = {
    SourceType.LINE_OA: ContentType.MESSAGE,
    SourceType.INSTAGRAM_DM: ContentType.MESSAGE,
    SourceType.INSTAGRAM_COMMENT: ContentType.COMMENT,
    SourceType.INSTAGRAM_REEL_COMMENT: ContentType.COMMENT,
    SourceType.INSTAGRAM_STORY_REPLY: ContentType.REPLY,
    SourceType.FACEBOOK_MESSENGER: ContentType.MESSAGE,
    SourceType.FACEBOOK_COMMENT: ContentType.COMMENT,
    SourceType.FACEBOOK_REEL_COMMENT: ContentType.COMMENT,
    SourceType.TIKTOK_DM: ContentType.MESSAGE,
    SourceType.TIKTOK_COMMENT: ContentType.COMMENT,
    SourceType.TIKTOK_VIDEO_COMMENT: ContentType.COMMENT,
    SourceType.WEB_CHAT: ContentType.MESSAGE,
    SourceType.WEB_FORM: ContentType.FORM,
    SourceType.LANDING_PAGE_FORM: ContentType.FORM,
    SourceType.FACEBOOK_AD_LEAD: ContentType.LEAD,
    SourceType.TIKTOK_AD_LEAD: ContentType.LEAD,
    SourceType.GOOGLE_AD_LEAD: ContentType.LEAD,
}

REQUIRED_CANONICAL_FIELDS: List[str] = ["tenant_id","clinic_id","branch_id","source_platform","source_type","external_user_id","message_text","timestamp"]
OPTIONAL_CANONICAL_FIELDS: List[str] = ["partner_id","campaign_id","affiliate_id","content_id","content_type"]

def validate_source_platform(source_platform: str) -> bool:
    try:
        SourcePlatform(source_platform)
        return True
    except ValueError:
        return False

def validate_source_type(source_type: str) -> bool:
    try:
        SourceType(source_type)
        return True
    except ValueError:
        return False

def validate_platform_and_source_type(source_platform: str, source_type: str) -> bool:
    try:
        platform_enum = SourcePlatform(source_platform)
        source_type_enum = SourceType(source_type)
    except ValueError:
        return False
    return source_type_enum in PLATFORM_SOURCE_TYPES.get(platform_enum, set())

def validate_canonical_inbound_event_shape(payload: Dict) -> List[str]:
    errors: List[str] = []
    for field in REQUIRED_CANONICAL_FIELDS:
        if field not in payload or payload[field] in (None, ""):
            errors.append(f"missing_required_field:{field}")
    source_platform = payload.get("source_platform")
    source_type = payload.get("source_type")
    if source_platform and not validate_source_platform(source_platform):
        errors.append(f"invalid_source_platform:{source_platform}")
    if source_type and not validate_source_type(source_type):
        errors.append(f"invalid_source_type:{source_type}")
    if source_platform and source_type:
        if not validate_platform_and_source_type(source_platform, source_type):
            errors.append(f"source_type_not_allowed_for_platform:{source_platform}:{source_type}")
    return errors

def get_content_type(source_type: str) -> Optional[ContentType]:
    try:
        st = SourceType(source_type)
    except ValueError:
        return None
    return SOURCE_CONTENT_TYPE.get(st)
