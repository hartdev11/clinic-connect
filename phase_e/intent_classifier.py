
def classify_intent(message):
    m = message.lower()
    score = 0
    high = ["ราคา", "จอง", "กี่บาท", "โปร", "วันนี้"]
    medium = ["ดีไหม", "ช่วยอะไร", "อันไหนดี"]
    for k in high:
        if k in m: score += 2
    for k in medium:
        if k in m: score += 1
    if score >= 2: return "high"
    elif score == 1: return "medium"
    return "low"
