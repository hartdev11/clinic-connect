from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional, Tuple


SUPPORTED_INTENTS = {
    "brand_inquiry",
    "pricing",
    "recommendation",
    "discovery",
    "booking",
    "promotion",
    "comparison",
    "objection",
    "safety",
    "doctor_inquiry",
    "location_hours",
    "general",
}


INTENT_KEYWORDS: Dict[str, List[str]] = {
    "brand_inquiry": [
        "ยี่ห้อ", "แบรนด์", "brand", "รุ่น", "ฟิลเลอร์ยี่ห้อ", "มียี่ห้ออะไร",
    ],
    "pricing": [
        "ราคา", "เท่าไหร่", "กี่บาท", "เริ่มต้น", "โปรเท่าไหร่", "แพงไหม", "งบ",
    ],
    "recommendation": [
        "เหมาะ", "ควรทำ", "แบบไหนดี", "อันไหนดี", "แนะนำ", "เหมาะกับผม", "เหมาะกับเรา",
        "ธรรมชาติ", "ทรงไหน", "ลุคไหนดี",
    ],
    "discovery": [
        "อยากทำ", "สนใจทำ", "อยากฉีด", "อยากเติม", "อยากลอง", "กำลังดูอยู่",
    ],
    "booking": [
        "จอง", "นัด", "คิว", "เข้าไปทำ", "วันนี้ว่างไหม", "พรุ่งนี้ว่างไหม",
        "book", "booking", "reserve",
    ],
    "promotion": [
        "โปร", "โปรโมชั่น", "ส่วนลด", "แถม", "promotion", "discount",
    ],
    "comparison": [
        "ต่างกันยังไง", "เปรียบเทียบ", "ดีกว่า", "ต่างกันไหม", "vs", "เทียบ",
    ],
    "objection": [
        "แพง", "กลัว", "เจ็บไหม", "ไม่มั่นใจ", "คุ้มไหม", "นานไหม", "อันตรายไหม",
        "บวมไหม", "พักฟื้น", "อยู่ได้นานไหม",
    ],
    "safety": [
        "ปลอดภัยไหม", "อันตรายไหม", "ผลข้างเคียง", "แพ้ไหม", "เสี่ยงไหม", "เจ็บไหม",
    ],
    "doctor_inquiry": [
        "หมอ", "แพทย์", "คุณหมอ", "doctor", "specialist",
    ],
    "location_hours": [
        "อยู่ที่ไหน", "สาขา", "เปิดกี่โมง", "ปิดกี่โมง", "เปิดไหม", "อยู่ตรงไหน",
        "location", "address", "เวลาเปิด", "เวลา", "เดินทาง",
    ],
}

PROCEDURE_HINTS = [
    "ปาก", "ฟิลเลอร์", "botox", "โบท็อกซ์", "โบท็อก", "ulthera", "filler",
    "แฟต", "fat", "ร้อยไหม", "ใต้ตา", "คาง", "จมูก", "กราม", "หน้าใส", "ผิว",
]


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


@dataclass
class IntentClassificationResult:
    intent: str
    confidence: float
    matched_keywords: List[str]
    procedure_hints: List[str]
    all_scores: Dict[str, int]
    reasoning: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def validate(self) -> Dict[str, Any]:
        errors: List[str] = []
        if self.intent not in SUPPORTED_INTENTS:
            errors.append(f"unsupported intent: {self.intent}")
        if not (0.0 <= self.confidence <= 1.0):
            errors.append("confidence must be between 0 and 1")
        if not isinstance(self.matched_keywords, list):
            errors.append("matched_keywords must be list")
        if not isinstance(self.procedure_hints, list):
            errors.append("procedure_hints must be list")
        if not isinstance(self.all_scores, dict):
            errors.append("all_scores must be dict")
        return {"valid": len(errors) == 0, "errors": errors}


class IntentClassifier:
    def classify_intent(self, message: str) -> IntentClassificationResult:
        text = _normalize_text(message)
        if not text:
            return IntentClassificationResult(
                intent="general",
                confidence=0.0,
                matched_keywords=[],
                procedure_hints=[],
                all_scores={intent: 0 for intent in SUPPORTED_INTENTS},
                reasoning="empty_message_default_general",
            )

        scores: Dict[str, int] = {}
        matched_by_intent: Dict[str, List[str]] = {}
        for intent, keywords in INTENT_KEYWORDS.items():
            matched = [kw for kw in keywords if kw in text]
            matched_by_intent[intent] = matched
            scores[intent] = len(matched)

        procedure_hints = [p for p in PROCEDURE_HINTS if p in text]
        priority_intent = self._apply_priority_rules(scores)
        if priority_intent:
            confidence = self._estimate_confidence(priority_intent, scores, boosted=True)
            return IntentClassificationResult(
                intent=priority_intent,
                confidence=confidence,
                matched_keywords=matched_by_intent.get(priority_intent, []),
                procedure_hints=procedure_hints,
                all_scores=scores,
                reasoning=f"priority_rule:{priority_intent}",
            )

        best_intent, best_score = self._pick_best_intent(scores)
        if best_score <= 0:
            return IntentClassificationResult(
                intent="general",
                confidence=0.2 if procedure_hints else 0.1,
                matched_keywords=[],
                procedure_hints=procedure_hints,
                all_scores=scores,
                reasoning="no_keyword_match_default_general",
            )

        confidence = self._estimate_confidence(best_intent, scores, boosted=False)
        return IntentClassificationResult(
            intent=best_intent,
            confidence=confidence,
            matched_keywords=matched_by_intent.get(best_intent, []),
            procedure_hints=procedure_hints,
            all_scores=scores,
            reasoning=f"score_based:{best_intent}",
        )

    def _apply_priority_rules(self, scores: Dict[str, int]) -> Optional[str]:
        if scores.get("booking", 0) > 0:
            return "booking"
        if scores.get("brand_inquiry", 0) > 0:
            return "brand_inquiry"
        if scores.get("pricing", 0) > 0:
            return "pricing"
        if scores.get("comparison", 0) > 0:
            return "comparison"
        if scores.get("recommendation", 0) > 0:
            return "recommendation"
        if scores.get("safety", 0) > 0:
            return "safety"
        if scores.get("doctor_inquiry", 0) > 0:
            return "doctor_inquiry"
        if scores.get("location_hours", 0) > 0:
            return "location_hours"
        if scores.get("discovery", 0) > 0:
            return "discovery"
        if scores.get("promotion", 0) > 0:
            return "promotion"
        if scores.get("objection", 0) > 0:
            return "objection"
        return None

    def _pick_best_intent(self, scores: Dict[str, int]) -> Tuple[str, int]:
        sortable = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        if not sortable:
            return "general", 0
        return sortable[0][0], sortable[0][1]

    def _estimate_confidence(self, chosen_intent: str, scores: Dict[str, int], boosted: bool) -> float:
        chosen = scores.get(chosen_intent, 0)
        if chosen <= 0:
            return 0.1
        sorted_scores = sorted(scores.values(), reverse=True)
        second = sorted_scores[1] if len(sorted_scores) > 1 else 0
        base = 0.85 if boosted else 0.65
        gap = chosen - second
        confidence = base + min(gap * 0.05, 0.12)
        return round(min(confidence, 0.98), 2)


_classifier = IntentClassifier()


def classify_intent(message: str) -> Dict[str, Any]:
    result = _classifier.classify_intent(message)
    return result.to_dict()


if __name__ == "__main__":
    test_cases = [
        "อยากทำปากครับ",
        "มียี่ห้ออะไรบ้างครับ",
        "ราคาเท่าไหร่ครับ",
        "แบบไหนเหมาะกับผมครับ",
        "",
    ]
    clf = IntentClassifier()
    for msg in test_cases:
        res = clf.classify_intent(msg)
        print(msg, "=>", res.to_dict(), res.validate())
