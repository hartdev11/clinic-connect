
from cta_engine import generate_cta

def generate_response(proc, intent):
    cta = generate_cta()
    if intent == "high":
        msg = f"เคสแบบคุณเหมาะกับ {proc}\nลูกค้าส่วนใหญ่เลือกทำตัวนี้ เห็นผลเร็ว\n👉 {cta['text']}\nจองคิววันนี้ได้เลยครับ"
    elif intent == "medium":
        msg = f"{proc} ช่วยแก้ปัญหานี้ได้ดี\nส่วนใหญ่เริ่มจาก consultation ก่อน\n👉 {cta['text']}"
    else:
        msg = f"แนะนำให้ประเมินก่อนครับ\n👉 {cta['text']}"
    return {"response": msg.strip(), "cta_id": cta["cta_id"]}
