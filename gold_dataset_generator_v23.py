# ==========================================
# Gold Dataset Generator v23
# ==========================================
# Architecture fixes ตาม feedback ลูกค้า:
# 1. Force customer mention product (fix product injection)
# 2. Style mode diversity system (fix semantic duplicate)
# 3. Opening uniqueness guard แทน full semantic check
# 4. CTA quota system จาก TARGET จริง
# 5. Exponential backoff MAX_RETRIES=5
# ==========================================

import os
import json
import csv
import hashlib
import random
import re
import time
import glob
import pandas as pd
from google import genai
from collections import defaultdict, Counter
from tqdm import tqdm

# =========================
# CONFIG
# =========================

TARGET       = 100_000
BATCH_NAME   = "gold_output_v23"
SEED         = 42
MODEL_NAME   = "gemini-2.5-flash-lite"
MAX_RETRIES  = 5                          # ✅ เพิ่มจาก 3 เป็น 5
MAX_ATTEMPTS = max(TARGET * 10, 20)

CTA_TARGET_RATIO = 0.40                   # ✅ CTA quota 40% ของ TARGET
CTA_QUOTA        = int(CTA_TARGET_RATIO * TARGET)

random.seed(SEED)
print(f"[CONFIG] TARGET={TARGET} | MODEL={MODEL_NAME} | SEED={SEED}")
print(f"[CONFIG] CTA_QUOTA={CTA_QUOTA} ({CTA_TARGET_RATIO*100:.0f}% of {TARGET})")

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError("GEMINI_API_KEY not found — run: set GEMINI_API_KEY=your_key")

client = genai.Client(api_key=API_KEY)

# =========================
# LOAD CSV
# =========================

p1 = pd.read_csv("p1_products.csv", comment="#")
p2 = pd.read_csv("p2_voices.csv",   comment="#")
p3 = pd.read_csv("p3_segments.csv", comment="#")
p4 = pd.read_csv("p4_intents.csv",  comment="#")
print(f"P1:{len(p1)} P2:{len(p2)} P3:{len(p3)} P4:{len(p4)}")

assert "id" in p2.columns, "p2_voices.csv ต้องมี column 'id'"
USE_P4_TEMPLATE = "template_id" in p4.columns
print(f"Template source: {'p4' if USE_P4_TEMPLATE else 'dist fallback'}")

# Product list
PRODUCT_LIST = [str(b).lower() for b in p1["brand"].tolist()]

# =========================
# GOLD TEMPLATES
# =========================

GOLD_TEMPLATES = {
    "T01": {"risk_level": "medium", "need_cta": True, "template": """[OBJECTION: กลัวไม่เห็นผล]
เข้าใจเลยค่ะว่าก่อนตัดสินใจทำ อยากมั่นใจว่าจะได้ผลลัพธ์ที่คุ้มค่านะคะ
โดยทั่วไปผลลัพธ์จะขึ้นอยู่กับสภาพผิวเดิมและความสม่ำเสมอในการทำค่ะ
ไม่ทราบว่ากังวลเรื่องผิวด้านไหนเป็นพิเศษคะ?
แนะนำเข้ามาปรึกษาเพื่อประเมินก่อนตัดสินใจนะคะ
ผลลัพธ์ขึ้นอยู่กับแต่ละบุคคล และควรอยู่ในการดูแลของแพทย์ค่ะ"""},
    "T02": {"risk_level": "low", "need_cta": True, "template": """[DISCOVERY: สนใจแต่ยังไม่รู้จะทำอะไร]
สวัสดีค่ะ ขอบคุณที่สนใจดูแลผิวนะคะ
การเลือกหัตถการจะขึ้นอยู่กับปัญหาผิวและสภาพผิวของแต่ละท่านค่ะ
ไม่ทราบว่าตอนนี้กังวลเรื่องไหนเป็นพิเศษคะ?
แนะนำให้คุณหมอประเมินผิวจริงก่อนเพื่อวางแผนให้ตรงจุดที่สุดนะคะ"""},
    "T03": {"risk_level": "high", "need_cta": False, "template": """[RISK CONCERN: กลัวเจ็บ/ผลข้างเคียง]
เข้าใจเลยค่ะว่ากังวลเรื่องความรู้สึกหรือผลข้างเคียง
โดยทั่วไปอาจมีอาการแดง บวมเล็กน้อยในช่วงแรก ซึ่งมักดีขึ้นภายในไม่กี่วันค่ะ
ผลลัพธ์ขึ้นอยู่กับแต่ละบุคคล และควรอยู่ในการดูแลของแพทย์ค่ะ
หากมีอาการผิดปกติ เช่น บวมมาก ปวดรุนแรง ควรติดต่อคลินิกทันทีนะคะ"""},
    "T04": {"risk_level": "low", "need_cta": True, "template": """[PRICE OBJECTION: แพงกว่าที่อื่น]
เข้าใจเลยค่ะว่าเรื่องงบประมาณเป็นปัจจัยสำคัญในการตัดสินใจ
ราคาอาจแตกต่างกันตามเครื่องมือ ประสบการณ์แพทย์ และมาตรฐานการดูแลค่ะ
ไม่ทราบว่าเคยทำมาก่อน หรือกำลังเปรียบเทียบกับโปรแกรมแบบไหนอยู่คะ?
สามารถเข้ามาปรึกษาดูแผนการรักษาและค่าใช้จ่ายโดยละเอียดก่อนตัดสินใจได้ค่ะ"""},
    "T05": {"risk_level": "high", "need_cta": True, "template": """[LONG-TERM SAFETY: ฉีดหลายปี/สลาย]
เป็นคำถามที่ดีมากเลยค่ะ
โดยทั่วไปฟิลเลอร์ประเภทที่สลายได้จะถูกดูดซึมตามธรรมชาติค่ะ
ผลลัพธ์ขึ้นอยู่กับแต่ละบุคคล และควรอยู่ในการดูแลของแพทย์ค่ะ
สะดวกให้แอดมินนัดปรึกษาคุณหมอก่อนไหมคะ?"""},
    "T06": {"risk_level": "low", "need_cta": False, "template": """[BOOKING: ขอจอง/ขอคิว]
ยินดีมากเลยค่ะ
ไม่ทราบว่าสนใจปรึกษาเรื่องใด หรืออยากทำหัตถการตัวไหนเป็นพิเศษคะ?
สะดวกช่วงวันหรือเวลาใดบ้างคะ?"""},
    "T07": {"risk_level": "low", "need_cta": True, "template": """[COMPETITOR: เปรียบเทียบคลินิกอื่น]
เข้าใจเลยค่ะว่าอยากเปรียบเทียบก่อนตัดสินใจ
แต่ละคลินิกมีมาตรฐานและวิธีการดูแลที่แตกต่างกันค่ะ
ที่นี่จะมีแพทย์ประเมินสภาพผิวจริงก่อนทุกครั้งเพื่อให้เหมาะสมที่สุดค่ะ
ไม่ทราบว่าอยากได้ข้อมูลเรื่องใดเพิ่มเติมคะ?"""},
    "T08": {"risk_level": "medium", "need_cta": False, "template": """[AFTERCARE: ดูแลหลังทำ]
หลังทำแนะนำให้หลีกเลี่ยงความร้อนจัดและแดดแรงประมาณ 2-3 วันค่ะ
อาการแดงหรือบวมเล็กน้อยเป็นเรื่องปกติและจะค่อยๆ ดีขึ้นเองค่ะ
ผลลัพธ์อาจแตกต่างกันในแต่ละบุคคลนะคะ หากมีอาการผิดปกติ เช่น บวมมาก ปวดรุนแรง ติดต่อคลินิกได้เลยค่ะ
ตอนนี้มีอาการไหนที่กังวลอยู่คะ?"""},
    "T09": {"risk_level": "high", "need_cta": False, "template": """[COMPLICATION: อาการผิดปกติหลังทำ]
ขอบคุณที่แจ้งมานะคะ อาการที่คุณลูกค้าบอกมาควรได้รับการประเมินจากแพทย์โดยตรงค่ะ
ผลลัพธ์ขึ้นอยู่กับแต่ละบุคคล และสิ่งสำคัญคือต้องให้แพทย์ดูแลใกล้ชิดนะคะ
แนะนำให้เข้ามาให้แพทย์ตรวจดูโดยเร็วเพื่อความปลอดภัยที่สุดค่ะ
สะดวกเข้ามาวันไหนคะ?"""},
    "T10": {"risk_level": "low", "need_cta": True, "template": """[PACKAGE MARKETING: โปรโมชั่น/เซต]
เรามีแพ็กเกจที่ออกแบบมาเพื่อดูแลผิวอย่างครบวงจรค่ะ
ผลลัพธ์จะขึ้นอยู่กับสภาพผิวและความต่อเนื่องในการดูแลของแต่ละท่านค่ะ
ไม่ทราบว่าสนใจดูแลผิวด้านไหนเป็นพิเศษคะ?
แนะนำให้คุณหมอประเมินก่อนเพื่อเลือกแพ็กเกจที่เหมาะสมที่สุดค่ะ"""}
}

INTENT_DIST = {
    "T01": 0.20, "T02": 0.20, "T03": 0.15, "T04": 0.10, "T05": 0.05,
    "T06": 0.10, "T07": 0.05, "T08": 0.10, "T09": 0.03, "T10": 0.02
}

def pick_template_by_dist():
    r = random.random()
    c = 0
    for tid, prob in INTENT_DIST.items():
        c += prob
        if r <= c:
            return tid
    return "T01"

# =========================
# STYLE MODE DIVERSITY (v23)
# =========================

STYLE_MODES = [
    "direct_informative",   # ตอบตรงๆ ข้อมูลชัดเจน
    "educational",          # อธิบายเชิงให้ความรู้
    "empathetic_short",     # เห็นใจแต่สั้น กระชับ
    "consultative",         # ถามเพื่อเข้าใจลูกค้าก่อน
    "comparison_style",     # เปรียบเทียบให้เห็นภาพ
    "myth_busting",         # แก้ความเข้าใจผิด
]

STYLE_INSTRUCTIONS = {
    "direct_informative":  "ตอบตรงประเด็น ให้ข้อมูลที่เป็นประโยชน์ทันที ไม่ต้องขึ้นต้นด้วยคำสุภาพยาวๆ",
    "educational":         "อธิบายให้ความรู้เชิงวิชาการเบาๆ ให้ลูกค้าเข้าใจก่อนตัดสินใจ",
    "empathetic_short":    "แสดงความเข้าใจสั้นๆ แล้วเข้าสู่เนื้อหาทันที ไม่เยิ่นเย้อ",
    "consultative":        "ถามเพื่อเข้าใจสถานการณ์ของลูกค้าก่อน แล้วค่อยให้คำแนะนำ",
    "comparison_style":    "เปรียบเทียบให้ลูกค้าเห็นความแตกต่างหรือข้อดีข้อเสียชัดเจน",
    "myth_busting":        "แก้ความเข้าใจผิดที่พบบ่อย แล้วให้ข้อมูลที่ถูกต้อง",
}

# =========================
# ENUM LOCK
# =========================

ALLOWED_TEMPLATE_IDS = {"T01","T02","T03","T04","T05","T06","T07","T08","T09","T10"}
ALLOWED_RISK_LEVELS  = {"low", "medium", "high"}
ALLOWED_VOICE_IDS    = {"V01","V02","V03","V04","V05","V06"}
ALLOWED_SEGMENT_IDS  = {"C01","C02","C03","C04","C05","C06","C07","C08","C09","C10"}
ALLOWED_INTENT_IDS   = {"I01","I02","I03","I04","I05","I06","I07","I08","I09","I10",
                        "I11","I12","I13","I14","I15","I16","I17","I18","I19","I20"}

def validate_brain(template_id, risk_level, voice_id, segment_id, intent_id):
    template_id = str(template_id).strip().upper()
    risk_level  = str(risk_level).strip().lower()
    voice_id    = str(voice_id).strip().upper()
    segment_id  = str(segment_id).strip().upper()
    intent_id   = str(intent_id).strip().upper()
    if template_id not in ALLOWED_TEMPLATE_IDS: return False, f"invalid_template_id:{template_id}"
    if risk_level  not in ALLOWED_RISK_LEVELS:  return False, f"invalid_risk_level:{risk_level}"
    if voice_id    not in ALLOWED_VOICE_IDS:    return False, f"invalid_voice_id:{voice_id}"
    if segment_id  not in ALLOWED_SEGMENT_IDS:  return False, f"invalid_segment_id:{segment_id}"
    if intent_id   not in ALLOWED_INTENT_IDS:   return False, f"invalid_intent_id:{intent_id}"
    return True, None

# =========================
# RISK-INTENT CONSISTENCY MAP
# =========================

INTENT_RISK_MAP = {
    "I06": "high", "I08": "high", "I09": "high",
    "I05": "medium", "I07": "medium",
}

def validate_risk_intent(intent_id, risk_level):
    expected = INTENT_RISK_MAP.get(intent_id.upper())
    if expected:
        return risk_level == expected
    return True

# =========================
# COMPLIANCE
# =========================

BANNED_CLAIMS = [
    "หายเลย", "เห็นผลแน่นอน", "ไม่เจ็บแน่นอน", "ปลอดภัย 100%",
    "การันตี", "รับรอง", "หายแน่นอน", "ไม่มีผลข้างเคียงเลย",
    "ปลอดภัยแน่นอน", "ไม่เจ็บเลย", "มั่นใจได้เลย",
]

DISCLAIMER_PATTERNS = [r"ขึ้นอยู่กับ", r"แตกต่าง"]

def contains_banned_claim(text):
    return any(term in text for term in BANNED_CLAIMS)

def has_disclaimer(text):
    return any(re.search(p, text) for p in DISCLAIMER_PATTERNS)

# =========================
# GEMINI CALL — exponential backoff (v23)
# =========================

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "customer_message": {"type": "string"},
        "admin_response":   {"type": "string"}
    },
    "required": ["customer_message", "admin_response"]
}

def call_gemini(prompt_text):
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=prompt_text,
                config={
                    "temperature": 0.7,              # ✅ เพิ่มกลับเป็น 0.7 เพื่อ diversity
                    "top_p": 0.9,
                    "max_output_tokens": 1000,
                    "response_mime_type": "application/json",
                    "response_schema": RESPONSE_SCHEMA
                }
            )
            if not response.text:
                raise ValueError("Empty response")
            return response.text
        except Exception as e:
            print(f"[API ERROR attempt {attempt+1}/{MAX_RETRIES}] {type(e).__name__}: {e}")
            if attempt == MAX_RETRIES - 1:
                return None
            sleep_time = (2 ** attempt) + random.random()  # ✅ exponential backoff + jitter
            print(f"[RETRY] sleeping {sleep_time:.1f}s...")
            time.sleep(sleep_time)
    return None

# =========================
# JSON EXTRACTOR
# =========================

def extract_json(text):
    text = text.strip().replace("\ufeff", "")
    text = re.sub(r"```json|```", "", text).strip()
    start = text.find("{")
    if start == -1:
        return None, "no_json_format"
    stack = 0
    for i in range(start, len(text)):
        if text[i] == "{": stack += 1
        elif text[i] == "}":
            stack -= 1
            if stack == 0:
                try:
                    return json.loads(text[start:i+1]), None
                except json.JSONDecodeError:
                    return None, "invalid_json"
    return None, "unbalanced_json"

# =========================
# HASH DEDUP
# =========================

def hash_pair(customer, admin):
    raw = re.sub(r"\s+", " ", (customer + "||" + admin).strip()).lower()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

# =========================
# VALIDATION HELPERS
# =========================

CTA_TERMS      = ["นัดหมาย", "เข้ามารับการรักษา", "ติดต่อนัด", "นัดเลย", "จองคิว"]  # hard only
SOFT_CTA_TERMS = ["ลองดู", "ดูรายละเอียด", "สอบถามเพิ่มเติม", "แวะมา", "ลองปรึกษา", "ยินดีให้ข้อมูล", "คุยกับคุณหมอ", "ให้ข้อมูลเพิ่มเติม", "ปรึกษาเพิ่มเติม", "แนะนำปรึกษา", "เข้ามาปรึกษา", "ปรึกษาคุณหมอ", "นัดปรึกษา", "ประเมินผิว", "เข้ามาประเมิน"]

def sentence_count(text):
    return len([s for s in re.split(r"[.!?]\s*|\n+", text) if s.strip()])

def has_cta(text):
    return any(w in text for w in CTA_TERMS + SOFT_CTA_TERMS)

def is_soft_cta(text):
    return any(w in text for w in SOFT_CTA_TERMS) and not any(w in text for w in CTA_TERMS)

def valid_structure(text, template_id):
    clean = re.sub(r"[^\w\s,.\-!?()ก-๙]+$", "", text.strip()).strip()
    return any(clean.endswith(e) for e in ["?", "ค่ะ", "นะคะ", "คะ", "ค่ะ.", "นะคะ.", "คะ."])

def detect_cta_type(text):
    if any(w in text for w in SOFT_CTA_TERMS): return "soft"  # เช็ค soft ก่อน
    if any(w in text for w in CTA_TERMS): return "hard"
    return "none"

def get_opening(text, length=60):
    """ดึง 60 chars แรกของ admin response สำหรับ opening uniqueness check"""
    return re.sub(r"\s+", " ", text.strip())[:length].lower()

def generate_distribution_report(records):
    return {
        "template": Counter(r["template_id"] for r in records),
        "intent":   Counter(r["intent_id"]   for r in records),
        "segment":  Counter(r["segment_id"]  for r in records),
        "voice":    Counter(r["voice_id"]    for r in records),
    }

# =========================
# MAIN LOOP
# =========================

# Resume from checkpoint
checkpoints = sorted(glob.glob("checkpoint_*.json"))
if checkpoints:
    latest = checkpoints[-1]
    with open(latest, encoding="utf-8") as f:
        results = json.load(f)
    seen_hashes   = {hash_pair(r["customer_message"], r["admin_response"]) for r in results}
    opening_history = {get_opening(r["admin_response"]) for r in results}
    cta_count     = sum(1 for r in results if r["has_cta"])
    print(f"[RESUME] Loaded {len(results)} records from {latest}")
else:
    results         = []
    seen_hashes     = set()
    opening_history = set()
    cta_count       = 0

reject_log   = []
reject_stats = defaultdict(int)
rejected     = 0
attempts     = 0

pbar = tqdm(total=TARGET, desc=f"Generating v23 [{BATCH_NAME}]")

while len(results) < TARGET:

    attempts += 1
    if attempts >= MAX_ATTEMPTS:
        pbar.close()
        raise RuntimeError(f"ABORT: Too many attempts ({attempts}) | Generated: {len(results)} / {TARGET}")

    # Sample CSV
    product          = p1.sample(1).iloc[0]
    voice            = p2.sample(1).iloc[0]
    segment          = p3.sample(1).iloc[0]
    intent           = p4.sample(1).iloc[0]
    is_first_message = random.choice([True, False])

    if USE_P4_TEMPLATE:
        template_id = str(intent["template_id"])
        if template_id not in GOLD_TEMPLATES:
            raise ValueError(f"Invalid template_id in p4: {template_id}")
    else:
        template_id = pick_template_by_dist()

    tmpl       = GOLD_TEMPLATES[template_id]
    risk_level = tmpl["risk_level"]
    intent_id  = str(intent["id"]).strip().upper()
    context    = "แชทแรก" if is_first_message else "คุยต่อเนื่อง"
    product_name = str(product["brand"])

    # Brain Enum Lock
    ok, reason = validate_brain(template_id, risk_level, str(voice["id"]), str(segment["id"]), intent_id)
    if not ok:
        rejected += 1; reject_stats[reason] += 1
        reject_log.append({"reason": reason, "template_id": template_id, "intent_id": intent_id}); continue

    # Risk-Intent consistency — soft check เท่านั้น ไม่ hard reject
    if not validate_risk_intent(intent_id, risk_level):
        print(f"[WARN] risk_mismatch intent={intent_id} risk={risk_level} (not rejected)")

    # ✅ CTA quota system — hard block เมื่อถึง quota
    remaining     = TARGET - len(results)
    cta_remaining = CTA_QUOTA - cta_count
    if cta_count >= CTA_QUOTA:
        allow_cta = False                      # hard block เมื่อถึง quota แล้ว
    elif cta_remaining >= remaining:
        allow_cta = True                       # force CTA ถ้าจะไม่ถึง quota
    elif risk_level == "high":
        allow_cta = random.random() < 0.60     # high risk โอกาส CTA สูง
    elif is_first_message:
        allow_cta = random.random() < 0.35
    else:
        allow_cta = random.random() < 0.20

    # ✅ Style mode diversity
    style_mode        = random.choice(STYLE_MODES)
    style_instruction = STYLE_INSTRUCTIONS[style_mode]

    # ✅ Build Prompt — force customer to mention product
    prompt  = "สร้างบทสนทนาคลีนิกความงาม 1 รอบ\n\n"
    prompt += f"หัตถการที่ลูกค้ากำลังถามถึง: {product_name}\n"
    prompt += f"Voice: {voice['name']}\n"
    prompt += f"ลูกค้า: {segment['name']}\n"
    prompt += f"Intent: {intent['name']}\n"
    prompt += f"Context: {context}\n"
    prompt += f"Admin response style: {style_mode} — {style_instruction}\n"
    prompt += f"Template:\n{tmpl['template']}\n\n"
    prompt += "กฎเหล็ก:\n"
    prompt += f"- customer_message ต้องพูดถึง '{product_name}' โดยตรง เช่น 'อยากลอง {product_name}' หรือ '{product_name} ดีไหมคะ'\n"
    prompt += f"- admin ห้ามพูดถึงชื่อ product อื่นนอกจาก '{product_name}' ที่ลูกค้ากล่าวถึงเท่านั้น ห้าม introduce brand หรือชื่อสารอื่นโดยเด็ดขาด\n"
    prompt += "- admin ตอบ intent ของลูกค้าก่อน ห้าม introduce product ใหม่ที่ลูกค้าไม่ได้กล่าวถึง\n"
    prompt += "- admin ตอบ 2-4 ประโยค ห้ามเกิน 5 ประโยค\n"
    prompt += f"- admin ต้องใช้ style '{style_mode}' ห้ามขึ้นต้นด้วยคำสุภาพทั่วไปซ้ำๆ เช่น เข้าใจเลยค่ะ ยินดีช่วยเลยค่ะ\n"
    prompt += "- โครงสร้างประโยคแรกของ admin ต้องแตกต่างจากรูปแบบ 'X คือ...' หรือ 'X เป็น...' เสมอ ให้คิด opening ใหม่ทุกครั้ง\n"
    prompt += "- ห้ามใช้ pattern: [product] + เป็น/คือ + [คำอธิบาย] ในประโยคแรก ให้เริ่มด้วย angle อื่น\n"
    prompt += "- ห้ามขึ้นต้นประโยคแรกด้วยชื่อ product ตามด้วย เป็น หรือ คือ เช่น 'Botox เป็น...' หรือ 'Filler คือ...'\n"
    prompt += "- ให้เริ่มต้นด้วย angle ที่หลากหลาย เช่น ถามความต้องการ / บอกประสบการณ์จริง / เปรียบเทียบ / อธิบายกระบวนการ / แก้ความเข้าใจผิด\n"
    prompt += "- ควรใช้คำลงท้ายสุภาพ เช่น ค่ะ หรือ นะคะ\n"
    prompt += "- ห้ามใช้คำ: ปลอดภัย 100% ไม่เจ็บเลย มั่นใจได้เลย หายแน่นอน การันตี รับรอง\n"
    prompt += "- ถ้าเป็นความเสี่ยงระดับ medium หรือ high ควรมีคำว่า 'ขึ้นอยู่กับแต่ละบุคคล'\n"
    prompt += "- ถ้าไม่ใช่แชทแรก ห้ามขึ้นต้นสวัสดี\n"
    prompt += "- ห้ามใช้ ค่าา มากๆๆ น้าา โอ้โหห\n"
    if allow_cta:
        # soft 80% / hard 20%
        use_soft = random.random() < 0.80
        if use_soft:
            cta_example = random.choice([
                "สอบถามเพิ่มเติมได้เลยนะคะ",
                "แวะมาคุยกับคุณหมอได้ค่ะ",
                "ลองปรึกษาดูก่อนได้เลยนะคะ",
                "ดูรายละเอียดเพิ่มเติมได้ค่ะ",
                "ยินดีให้ข้อมูลเพิ่มเติมนะคะ",
                "เข้ามาปรึกษาเพิ่มเติมได้เลยค่ะ",
                "ปรึกษาคุณหมอก่อนได้เลยนะคะ",
                "นัดปรึกษาได้เลยนะคะ",
                "ประเมินผิวก่อนได้เลยค่ะ",
            ])
            prompt += f"- admin ต้องใส่ soft CTA เช่น '{cta_example}' ท้ายประโยค ห้ามใช้คำ 'นัดหมาย' หรือ 'จองคิว'\n"
        else:
            cta_example = random.choice([
                "สะดวกนัดหมายได้เลยนะคะ",
                "จองคิวได้เลยค่ะ",
            ])
            prompt += f"- admin ใส่ CTA เช่น '{cta_example}' ท้ายประโยคสุดท้าย\n"
    else:
        prompt += "- รอบนี้ไม่ต้องมี CTA ให้ตอบข้อมูลที่เป็นประโยชน์อย่างเดียว\n"
    prompt += '\nOutput JSON: {"customer_message": "...", "admin_response": "..."}'

    # Call Gemini
    model_output = call_gemini(prompt)
    if model_output is None:
        print("❌ REJECT: api_failure")
        rejected += 1; reject_stats["api_failure"] += 1
        reject_log.append({"reason": "api_failure", "template_id": template_id, "intent_id": intent_id}); continue

    # JSON Extract
    data, err = extract_json(model_output)
    if err:
        print(f"❌ REJECT: {err}")
        rejected += 1; reject_stats[err] += 1
        reject_log.append({"reason": err, "template_id": template_id, "intent_id": intent_id}); continue

    if not isinstance(data, dict):
        rejected += 1; reject_stats["invalid_json_root"] += 1
        reject_log.append({"reason": "invalid_json_root", "template_id": template_id, "intent_id": intent_id}); continue

    if "customer_message" not in data or "admin_response" not in data:
        rejected += 1; reject_stats["missing_required_keys"] += 1
        reject_log.append({"reason": "missing_required_keys", "template_id": template_id, "intent_id": intent_id}); continue

    customer = str(data["customer_message"]).strip()
    admin    = str(data["admin_response"]).strip()

    if not customer or not admin:
        rejected += 1; reject_stats["empty_text"] += 1
        reject_log.append({"reason": "empty_text", "template_id": template_id, "intent_id": intent_id}); continue

    # Validation helper
    def reject(reason, sample=None):
        global rejected
        rejected += 1
        reject_stats[reason] += 1
        entry = {"reason": reason, "template_id": template_id, "intent_id": intent_id}
        if sample: entry["sample"] = sample[:120]
        print("❌ REJECT:", reason)
        if sample: print("   SAMPLE:", sample[:120]); print()
        reject_log.append(entry)

    if len(customer) < 5 or len(admin) < 10:
        reject("too_short"); continue

    if contains_banned_claim(admin):
        reject("banned_claim", admin); continue

    # Product injection check — whitelist คำวิทยาศาสตร์ที่ไม่ใช่ product
    INJECTION_WHITELIST = {
        "trichloroacetic", "hyaluronic", "botulinum", "collagen", "exosomes",
        "spf", "uv", "dna", "rna", "ha", "cc", "pdrn", "prp", "led",
        "thai", "acid", "vitamin", "peptide", "laser", "filler",
    }
    admin_brands    = set(re.findall(r'[A-Z][a-zA-Z]{2,}', admin))
    customer_brands = set(re.findall(r'[A-Z][a-zA-Z]{2,}', customer))
    injected_brands = {
        b for b in (admin_brands - customer_brands)
        if not any(w in b.lower() for w in INJECTION_WHITELIST)
    }
    if injected_brands:
        reject("product_injection", f"injected={injected_brands} | {admin[:80]}"); continue

    # Auto-repair disclaimer
    if risk_level in ["medium", "high"] and not has_disclaimer(admin):
        admin += " ผลลัพธ์อาจแตกต่างกันในแต่ละบุคคลค่ะ"

    # sentence_count soft check
    if sentence_count(admin) > 5:
        print(f"[WARN] too_many_sentences: {admin[:60]}")

    if not valid_structure(admin, template_id):
        reject("invalid_structure", admin); continue

    # ✅ Opening uniqueness guard (แทน full semantic check)
    opening = get_opening(admin)
    if opening in opening_history:
        reject("opening_duplicate"); continue
    opening_history.add(opening)

    # SHA256 exact dedup
    h = hash_pair(customer, admin)
    if h in seen_hashes:
        reject("duplicate"); continue
    seen_hashes.add(h)

    # Append
    record_has_cta = has_cta(admin)
    if record_has_cta:
        cta_count += 1

    results.append({
        "customer_message": customer,
        "admin_response":   admin,
        "voice_id":         str(voice["id"]),
        "segment_id":       str(segment["id"]),
        "intent_id":        intent_id,
        "template_id":      template_id,
        "risk_level":       risk_level,
        "is_first_message": is_first_message,
        "has_cta":          record_has_cta,
        "cta_type":         detect_cta_type(admin),
        "style_mode":       style_mode,
    })

    pbar.update(1)
    time.sleep(random.uniform(0.1, 0.3))

    if len(results) % 1000 == 0 and len(results) > 0:
        with open(f"checkpoint_{len(results)}.json", "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False)
        print(f"\n[CHECKPOINT] {len(results)} saved | Rejected: {rejected} | CTA: {cta_count}/{len(results)}")

pbar.close()

# =========================
# SAVE OUTPUT
# =========================

with open(f"{BATCH_NAME}.json", "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

# Reject log CSV
with open("reject_log_v23.csv", "w", newline="", encoding="utf-8") as f:
    if reject_log:
        writer = csv.DictWriter(f, fieldnames=["reason", "template_id", "intent_id", "sample"])
        writer.writeheader()
        for r in reject_log:
            writer.writerow({
                "reason":      r.get("reason", ""),
                "template_id": r.get("template_id", ""),
                "intent_id":   r.get("intent_id", ""),
                "sample":      r.get("sample", ""),
            })

with open("reject_log_v23.json", "w", encoding="utf-8") as f:
    json.dump(reject_log, f, ensure_ascii=False, indent=2)

print(f"\n✅ DONE | Generated: {len(results)} | Rejected: {rejected} | Attempts: {attempts}")

# =========================
# REPORTS
# =========================

print("\n=== REJECT SUMMARY ===")
for k, v in sorted(reject_stats.items(), key=lambda x: -x[1]):
    pct = v / rejected * 100 if rejected else 0
    print(f"  {k}: {v} ({pct:.1f}%)")

report = generate_distribution_report(results)
print("\n=== DISTRIBUTION REPORT ===")
for k, v in report.items():
    print(f"\n[{k}]")
    for key, val in v.most_common():
        pct = val / len(results) * 100 if results else 0
        print(f"  {key}: {val} ({pct:.1f}%)")

print(f"\n=== CTA RATE ===")
print(f"  has_cta: {cta_count}/{len(results)} ({cta_count/len(results)*100:.1f}%) | quota={CTA_QUOTA}")

risk_dist = Counter(r["risk_level"] for r in results)
print(f"\n=== RISK DISTRIBUTION ===")
for k, v in risk_dist.most_common():
    print(f"  {k}: {v} ({v/len(results)*100:.1f}%)")

style_dist = Counter(r.get("style_mode", "unknown") for r in results)
print(f"\n=== STYLE MODE DISTRIBUTION ===")
for k, v in style_dist.most_common():
    print(f"  {k}: {v} ({v/len(results)*100:.1f}%)")
