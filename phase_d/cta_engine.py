
from typing import Dict

class CTAEngine:
    def __init__(self, context_loader):
        self.context_loader = context_loader

    def generate(self, intent_data: Dict, state: Dict, main_procedure: str, context: Dict) -> Dict:
        stage = state.get("conversation_stage", "awareness")
        proc_data = self.context_loader.get_procedure_by_id(main_procedure)
        name = proc_data.get("name", "หัตถการนี้")
        if stage == "awareness":
            return self._soft_cta(name)
        elif stage == "consideration":
            return self._mid_cta(name)
        else:
            return self._hard_cta(name, context)

    def _soft_cta(self, name: str) -> Dict:
        return {"cta_text": f"ถ้าสนใจ {name} เดี๋ยวอธิบายรายละเอียดเพิ่มเติมให้ได้นะคะ 😊", "type": "soft"}

    def _mid_cta(self, name: str) -> Dict:
        return {"cta_text": f"ถ้ากำลังลังเลระหว่างตัวนี้กับตัวอื่น เดี๋ยวช่วยเปรียบเทียบให้ได้นะคะ", "type": "suggestion"}

    def _hard_cta(self, name: str, context: Dict) -> Dict:
        packages = context.get("packages", [])
        if packages:
            return {"cta_text": f"ตอนนี้ {name} มีโปรพิเศษ แนะนำจองคิววันนี้ล็อคราคาไว้ก่อนได้นะคะ", "type": "urgency"}
        return {"cta_text": f"แนะนำจองคิว {name} ไว้ก่อนนะคะ ช่วงนี้คิวค่อนข้างเต็มค่ะ", "type": "scarcity"}
