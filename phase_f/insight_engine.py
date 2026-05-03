
import json

INPUT_METRICS = "metrics_output.json"
INPUT_ANALYTICS = "analytics_output.json"
OUTPUT_FILE = "insight_output.json"

def generate_insights(metrics, analytics):
    insights = []
    alerts = []
    summary = metrics.get("summary", {})
    conv = summary.get("conversion_rate", 0)
    ctr = summary.get("ctr", 0)

    if conv < 0.08:
        insights.append("Conversion ต่ำ → ควรเพิ่มโปรโมชัน / ปรับ CTA")
        alerts.append("LOW_CONVERSION")
    elif conv > 0.12:
        insights.append("Conversion สูง → แนะนำเพิ่ม traffic เพื่อ scale")
    else:
        insights.append("Conversion อยู่ในเกณฑ์ดี สามารถ optimize เพิ่มได้")

    if ctr < 0.05:
        insights.append("CTR ต่ำ → CTA ยังไม่ดึงดูด ควรปรับข้อความ/offer")
        alerts.append("LOW_CTR")
    elif ctr > 0.12:
        insights.append("CTR ดี → CTA ทำงานได้ดีแล้ว")
    else:
        insights.append("CTR อยู่ในเกณฑ์ปกติ")

    top_procs = analytics.get("top_procedures_enhanced", [])
    if top_procs:
        best = top_procs[0]
        insights.append(f"ควร push {best['procedure_id']} ทำรายได้สูงสุด")

    cta_perf = analytics.get("cta_performance", [])
    if cta_perf:
        best_cta = cta_perf[0]
        insights.append(f"CTA ที่ดีที่สุด: {best_cta['cta_id']} (conversion {best_cta['conversion']})")

    revenue = summary.get("total_revenue", 0)
    if revenue <= 0:
        alerts.append("NO_REVENUE")
        insights.append("ยังไม่มีรายได้ → ต้องเร่งปิดการขาย")

    return insights, alerts

def main():
    print("🧠 Running Insight Engine...\n")
    with open(INPUT_METRICS, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    with open(INPUT_ANALYTICS, "r", encoding="utf-8") as f:
        analytics = json.load(f)
    insights, alerts = generate_insights(metrics, analytics)
    output = {"insights": insights, "alerts": alerts}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print("✅ insight_output.json generated")
    print("\n📊 INSIGHTS:")
    for i in insights:
        print("-", i)
    if alerts:
        print("\n⚠ ALERTS:")
        for a in alerts:
            print("-", a)

if __name__ == "__main__":
    main()
