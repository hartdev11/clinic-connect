from typing import Dict, List


class ScoringEngine:

    def __init__(self, context_loader):
        self.context_loader = context_loader

    def score(self, proc_ids: List[str], intent_data: Dict, state: Dict) -> List[Dict]:
        stage = state.get("conversation_stage", "awareness")
        primary_intent = intent_data.get("primary_intent", "consultation")
        scored = []

        for proc_id in proc_ids:
            proc = self.context_loader.get_procedure_by_id(proc_id)
            score = 1.0

            if stage == "decision":
                score += 0.5
            elif stage == "consideration":
                score += 0.3

            if primary_intent == "booking":
                score += 0.4
            elif primary_intent == "pricing":
                score += 0.2

            downtime = proc.get("downtime", "low")
            if downtime == "none":
                score += 0.2
            elif downtime == "low":
                score += 0.1

            scored.append({
                "procedure_id": proc_id,
                "name": proc.get("name", proc_id),
                "score": round(score, 4)
            })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored


if __name__ == "__main__":
    from context_loader import ContextLoader
    loader = ContextLoader("./dataset")
    engine = ScoringEngine(loader)

    proc_ids = ["proc_001", "proc_006", "proc_021"]
    intent = {"primary_intent": "consultation"}
    state = {"conversation_stage": "consideration"}

    result = engine.score(proc_ids, intent, state)
    for r in result:
        print(r)
