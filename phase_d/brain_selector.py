
from typing import Dict

class BrainSelector:
    def __init__(self):
        self.intent_brain_map = {
            "consultation": "consultation_brain",
            "comparison": "consultation_brain",
            "objection": "sales_brain",
            "pricing": "sales_brain",
            "booking": "sales_brain"
        }

    def select_brain(self, intent_data: Dict, state: Dict) -> Dict:
        primary_intent = intent_data.get("primary_intent")
        stage = state.get("conversation_stage", "awareness")
        base_brain = self.intent_brain_map.get(primary_intent, "consultation_brain")
        selected_brain, reason = self._apply_stage_logic(base_brain, stage, primary_intent)
        confidence = self._calculate_confidence(primary_intent, stage)
        return {"selected_brain": selected_brain, "confidence": confidence, "reason": reason}

    def _apply_stage_logic(self, base_brain: str, stage: str, intent: str):
        if stage == "decision":
            return "sales_brain", "user is in decision stage"
        if intent == "objection":
            return "sales_brain", "handling objection"
        if stage == "consideration":
            return "sales_brain", "user comparing options"
        return base_brain, "based on intent"

    def _calculate_confidence(self, intent: str, stage: str) -> float:
        score = 0.5
        if intent in ["booking", "pricing"]:
            score += 0.3
        if stage == "decision":
            score += 0.2
        return min(score, 1.0)
