
from typing import Dict
from datetime import datetime

class ConversationStateManager:
    def __init__(self):
        self.memory_store: Dict[str, Dict] = {}

    def _get_default_state(self, user_id: str) -> Dict:
        return {
            "user_id": user_id,
            "conversation_stage": "awareness",
            "intent_history": [],
            "recommended_procedures": [],
            "last_cta": None,
            "last_interaction": datetime.utcnow().isoformat()
        }

    def get_state(self, user_id: str) -> Dict:
        if user_id not in self.memory_store:
            self.memory_store[user_id] = self._get_default_state(user_id)
        return self.memory_store[user_id]

    def update_intent(self, user_id: str, intent: str):
        state = self.get_state(user_id)
        state["intent_history"].append(intent)
        state["last_interaction"] = datetime.utcnow().isoformat()
        self._update_stage(state)

    def update_recommendations(self, user_id: str, procedures: list):
        state = self.get_state(user_id)
        for proc in procedures:
            if proc not in state["recommended_procedures"]:
                state["recommended_procedures"].append(proc)
        state["last_interaction"] = datetime.utcnow().isoformat()

    def update_cta(self, user_id: str, cta: str):
        state = self.get_state(user_id)
        state["last_cta"] = cta
        state["last_interaction"] = datetime.utcnow().isoformat()

    def _update_stage(self, state: Dict):
        history = state["intent_history"]
        if not history:
            return
        if "booking" in history:
            state["conversation_stage"] = "decision"
        elif "pricing" in history or "comparison" in history:
            state["conversation_stage"] = "consideration"
        else:
            state["conversation_stage"] = "awareness"

    def reset_state(self, user_id: str):
        self.memory_store[user_id] = self._get_default_state(user_id)
