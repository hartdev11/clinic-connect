
import random
import uuid

def generate_cta():
    cta_id = "cta_" + str(uuid.uuid4())[:8]
    offers = [
        {"text": "🔥 ลด 30% วันนี้เท่านั้น", "type": "discount"},
        {"text": "⏰ เหลือ 3 เคสสุดท้าย", "type": "scarcity"},
        {"text": "💎 ฟรี consultation", "type": "bonus"},
        {"text": "⚡ ราคา 9,900 บาท วันนี้", "type": "price"}
    ]
    selected = random.choice(offers)
    return {"cta_id": cta_id, "text": selected["text"], "type": selected["type"]}
