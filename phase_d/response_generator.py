
from typing import Dict, List

class ResponseGenerator:
    def __init__(self, context_loader):
        self.context_loader = context_loader

    def generate(self, brain_data: Dict, intent_data: Dict, state: Dict, ranked_procedures: List[str], context: Dict) -> Dict:
        stage = state.get("conversation_stage", "awareness")
        if not ranked_procedures:
            return {"text": "ขอข้อมูลเพิ่มเติมนิดนึงนะคะ จะได้แนะนำได้ตรงมากขึ้น 😊", "tone": "fallback"}
        main_proc = ranked_procedures[0]
        proc_data = self.context_loader.get_procedure_by_id(main_proc)
        name = proc_data.get("name", "หัตถการนี้")
        indications = proc_data.get("indications", ["ปรับรูปหน้า"])
        benefit = indications[0].replace("_", " ") if indications else "ปรับรูปหน้า"
        if stage == "awareness":
            text = self._awareness_response(name, benefit)
        elif stage == "consideration":
            text = self._consideration_response(name, benefit, ranked_procedures)
        else:
            text = self._decision_response(name, benefit)
        return {"text": text, "tone": stage, "main_procedure": main_proc}

    def _awareness_response(self, name: str, benefit: str) -> str:
        return f"ถ้าดูจากปัญหาที่เล่ามา แนะนำ {name} ค่ะ เพราะช่วยเรื่อง{benefit} จะช่วยให้เห็นผลค่อนข้างชัดเจน 😊"

    def _consideration_response(self, name: str, benefit: str, procs: List[str]) -> str:
        extra = " หรือมีอีกตัวที่ใกล้เคียงกัน เดี๋ยวอธิบายเปรียบเทียบให้ได้นะคะ" if len(procs) > 1 else ""
        return f"{name} จะเด่นในเรื่อง{benefit}{extra}"

    def _decision_response(self, name: str, benefit: str) -> str:
        return f"ตัว {name} เหมาะกับเคสนี้มากค่ะ เพราะช่วยเรื่อง{benefit} แนะนำจองคิวไว้ก่อนนะคะ"
