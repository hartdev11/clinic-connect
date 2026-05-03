
from typing import Dict, List
import re

class IntentRouter:
    def __init__(self):
        self.intent_keywords = {
            "consultation": ["ทำอะไรดี", "แนะนำ", "เหมาะกับ", "แก้ปัญหา", "อยาก", "ควรทำ", "ดีไหม", "คืออะไร"],
            "comparison": ["ต่างกัน", "ดีกว่า", "เทียบ", "vs", "ระหว่าง"],
            "objection": ["อันตรายไหม", "เจ็บไหม", "ปลอดภัยไหม", "อยู่ได้นานไหม", "ผลข้างเคียง", "กลัว"],
            "pricing": ["ราคา", "กี่บาท", "เท่าไหร่", "โปร", "โปรโมชั่น"],
            "booking": ["จอง", "นัด", "คิว", "วันนี้ว่างไหม", "พรุ่งนี้ว่างไหม", "ต้องการทำ", "สนใจทำ", "อยากจอง", "ตัดสินใจ", "ทำเลย"]
        }
        self.default_intent = "consultation"

    def preprocess(self, text: str) -> str:
        text = text.lower()
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    def detect_intents(self, text: str) -> Dict[str, int]:
        scores = {intent: 0 for intent in self.intent_keywords}
        for intent, keywords in self.intent_keywords.items():
            for kw in keywords:
                if kw in text:
                    scores[intent] += 1
        return scores

    def get_primary_intent(self, scores: Dict[str, int]) -> str:
        max_score = 0
        selected_intent = self.default_intent
        for intent, score in scores.items():
            if score > max_score:
                max_score = score
                selected_intent = intent
        return selected_intent

    def get_secondary_intents(self, scores: Dict[str, int], primary: str) -> List[str]:
        return [intent for intent, score in scores.items() if intent != primary and score > 0]

    def route(self, user_input: str) -> Dict:
        clean_text = self.preprocess(user_input)
        scores = self.detect_intents(clean_text)
        primary_intent = self.get_primary_intent(scores)
        secondary_intents = self.get_secondary_intents(scores, primary_intent)
        return {
            "primary_intent": primary_intent,
            "secondary_intents": secondary_intents,
            "scores": scores,
            "raw_text": user_input,
            "clean_text": clean_text
        }
