
import json

METRICS_FILE = "metrics_output.json"
ANALYTICS_FILE = "analytics_output.json"
OUTPUT_FILE = "insight_output.json"

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def build_insights(metrics, analytics):
    insights = []
    alerts = []
    overview = metrics.get("overview", {})
    best_worst = analytics.get("best_worst", {})
    business_metrics = analytics.get("business_metrics", {})
    role_analytics = analytics.get("role_analytics", {})
    affiliate_data = metrics.get("affiliate", {})
    agent_data = metrics.get("agent", {})
    branch_data = metrics.get("branch_performance", {}).get("branches", [])
    conversion_rate = overview.get("conversion_rate", 0)
    ctr = overview.get("ctr", 0)
    revenue = overview.get("total_revenue", 0)

    if conversion_rate < 0.08:
        alerts.append({"code":"LOW_CONVERSION","message":f"Conversion rate ต่ำ ({conversion_rate}) ควรปรับ CTA","severity":"high"})
        insights.append({"type":"conversion","title":"Conversion ต่ำกว่ามาตรฐาน","message":"ควรตรวจจุด drop ใน funnel","priority":"high"})
    else:
        insights.append({"type":"conversion","title":"Conversion อยู่ในเกณฑ์ดี","message":f"Conversion rate = {conversion_rate}","priority":"medium"})

    if ctr < 0.05:
        alerts.append({"code":"LOW_CTR","message":f"CTR ต่ำ ({ctr})","severity":"medium"})
        insights.append({"type":"ctr","title":"CTR ต่ำกว่ามาตรฐาน","message":"ควรปรับ CTA","priority":"medium"})
    else:
        insights.append({"type":"ctr","title":"CTR อยู่ในเกณฑ์","message":f"CTR = {ctr}","priority":"low"})

    if revenue <= 0:
        alerts.append({"code":"NO_REVENUE","message":"ยังไม่มีรายได้","severity":"high"})

    best_proc = best_worst.get("best_procedure", {})
    if best_proc.get("procedure_id"):
        insights.append({"type":"procedure","title":"Procedure ที่ทำเงินดีที่สุด","message":f"ควร push {best_proc.get('procedure_name') or best_proc.get('procedure_id')} รายได้ {best_proc.get('revenue',0)}","priority":"high"})

    best_ch = best_worst.get("best_channel", {})
    if best_ch.get("channel"):
        insights.append({"type":"channel","title":"ช่องทางที่ทำรายได้ดีที่สุด","message":f"{best_ch.get('channel')} ทำรายได้ {best_ch.get('revenue',0)}","priority":"medium"})

    worst_br = best_worst.get("worst_branch", {})
    if worst_br.get("branch_id"):
        insights.append({"type":"branch","title":"สาขา performance ต่ำสุด","message":f"สาขา {worst_br.get('branch_id')} รายได้ {worst_br.get('revenue',0)}","priority":"medium"})

    insights.append({"type":"business","title":"มูลค่าเฉลี่ยต่อ session","message":f"Revenue per session = {business_metrics.get('revenue_per_session',0)}","priority":"low"})
    insights.append({"type":"business","title":"มูลค่าเฉลี่ยต่อ user","message":f"Revenue per user = {business_metrics.get('revenue_per_user',0)}","priority":"low"})

    if affiliate_data.get("total_clicks", 0) > 0:
        insights.append({"type":"affiliate","title":"Affiliate channel กำลังทำงาน","message":f"clicks {affiliate_data.get('total_clicks',0)} bookings {affiliate_data.get('total_bookings',0)}","priority":"medium"})

    if agent_data.get("total_leads", 0) > 0:
        close_rate = agent_data.get("close_rate", 0)
        insights.append({"type":"agent","title":"ภาพรวม sales agent","message":f"Close rate = {close_rate}","priority":"medium"})
        if close_rate < 0.08:
            alerts.append({"code":"LOW_AGENT_CLOSE_RATE","message":f"Close rate ต่ำ ({close_rate})","severity":"medium"})

    if branch_data:
        low = [b for b in branch_data if b.get("conversion_rate",0) < 0.05]
        if low:
            alerts.append({"code":"LOW_BRANCH_CONVERSION","message":f"มี {len(low)} สาขา conversion ต่ำ","severity":"medium"})

    owner_data = role_analytics.get("owner", {})
    if owner_data:
        insights.append({"type":"owner","title":"ภาพรวม owner","message":f"รายได้รวม {owner_data.get('total_revenue',0)} สาขา {owner_data.get('branch_count',0)}","priority":"low"})

    return {"insights": insights, "alerts": alerts}

def main():
    print("🧠 Running Insight Engine...\n")
    metrics = load_json(METRICS_FILE)
    analytics = load_json(ANALYTICS_FILE)
    result = build_insights(metrics, analytics)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print("✅ Insight generated: insight_output.json")
    print("\n📌 INSIGHTS")
    for item in result["insights"][:5]:
        print("-", item["title"])
    if result["alerts"]:
        print("\n⚠ ALERTS")
        for item in result["alerts"][:5]:
            print("-", item["code"])

if __name__ == "__main__":
    main()
