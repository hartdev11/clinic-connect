
from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional

@dataclass
class LeadScoreResult:
    lead_id: str
    score: int
    level: str
    reasons: List[str]
    priority_action: str

class LeadScoringEngine:
    def __init__(self):
        self.high_intent_keywords = ["ราคา","กี่บาท","โปร","จอง","นัด","วันนี้","book","appointment"]
        self.medium_intent_keywords = ["ดีไหม","ช่วยอะไร","เหมาะไหม","อันไหนดี","botox","filler","ulthera"]
        self.risk_keywords = ["อันตราย","ผลข้างเคียง","แพทย์","doctor","ร้องเรียน","ไม่พอใจ"]
        self.source_weight = {"line":20,"instagram":15,"facebook":12,"tiktok":10,"web":18,"ads":14}
        self.source_type_weight = {"line_oa":10,"instagram_dm":10,"instagram_comment":4,"instagram_reel_comment":5,"instagram_story_reply":8,"facebook_messenger":10,"facebook_comment":4,"facebook_reel_comment":5,"facebook_ad_lead":8,"tiktok_dm":9,"tiktok_comment":4,"tiktok_video_comment":5,"tiktok_ad_lead":8,"web_chat":12,"web_form":15,"landing_page_form":18,"google_ad_lead":16}

    def score(self, intake_result, pipeline_result=None, history=None):
        lead = intake_result["lead"]
        event = intake_result["canonical_event"]
        score = 0
        reasons = []

        platform_score = self.source_weight.get(event.get("source_platform",""), 0)
        score += platform_score
        if platform_score: reasons.append(f"source_platform+{platform_score}")

        type_score = self.source_type_weight.get(event.get("source_type",""), 0)
        score += type_score
        if type_score: reasons.append(f"source_type+{type_score}")

        text = (event.get("message_text") or "").lower()
        high = sum(1 for k in self.high_intent_keywords if k in text)
        medium = sum(1 for k in self.medium_intent_keywords if k in text)
        risk = sum(1 for k in self.risk_keywords if k in text)

        if high:
            boost = min(high*12, 30)
            score += boost
            reasons.append(f"high_intent+{boost}")
        elif medium:
            boost = min(medium*6, 18)
            score += boost
            reasons.append(f"medium_intent+{boost}")

        if event.get("campaign_id"): score += 8; reasons.append("campaign+8")
        if event.get("affiliate_id"): score += 5; reasons.append("affiliate+5")

        if pipeline_result:
            p = pipeline_result.get("pipeline", {})
            if p.get("quoted_price") is not None: score += 12; reasons.append("quoted_price+12")
            if p.get("promotion_id"): score += 10; reasons.append("promotion+10")
            if p.get("booking_intent"): score += 25; reasons.append("booking_intent+25")
            if p.get("handoff_required"): score -= 10; reasons.append("handoff-10")

        if history:
            prev = int(history.get("previous_sessions", 0))
            prev_b = int(history.get("previous_bookings", 0))
            if prev >= 1: boost = min(prev*5,15); score += boost; reasons.append(f"revisit+{boost}")
            if prev_b >= 1: score += 12; reasons.append("returning+12")

        if risk: penalty = min(risk*8,20); score -= penalty; reasons.append(f"risk-{penalty}")

        score = max(0, min(score, 100))
        level = "hot" if score >= 80 else ("warm" if score >= 55 else "cold")

        action = "handoff_to_staff"
        if pipeline_result:
            p = pipeline_result.get("pipeline", {})
            if p.get("handoff_required"): action = "handoff_to_staff"
            elif p.get("booking_intent"): action = "push_booking_now"
            elif p.get("quoted_price") is not None and score >= 60: action = "send_cta_and_followup"
            elif score >= 80: action = "priority_followup"
            elif score >= 55: action = "educate_and_offer"
            else: action = "nurture_only"
        else:
            action = "priority_followup" if score >= 80 else ("educate_and_offer" if score >= 55 else "nurture_only")

        return LeadScoreResult(lead_id=lead["lead_id"], score=score, level=level, reasons=reasons, priority_action=action)
