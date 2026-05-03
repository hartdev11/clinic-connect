
import json
import random
import uuid
from datetime import datetime, timedelta

OUTPUT_FILE = "events.jsonl"
NUM_USERS = 350
MAX_SESSIONS_PER_USER = 3

PROCEDURES = [
    ("proc_001","Botox ลดกราม",["botox","jawline"]),
    ("proc_002","Filler ปาก",["filler","lip"]),
    ("proc_003","Filler คาง",["filler","chin"]),
    ("proc_004","Ulthera",["ulthera","lifting"]),
    ("proc_005","Thermage",["thermage","lifting"]),
    ("proc_006","Acne Program",["skin","acne"]),
    ("proc_007","Brightening Program",["skin","bright"]),
]
CHANNELS = ["line","instagram","facebook","tiktok","web"]
BRANCHES = ["bkk_siam","bkk_ladprao","cnx_nimman","hkt_oldtown"]
BOOKING_STATUSES = ["pending","confirmed","completed","cancelled"]
AFFILIATES = ["aff_001","aff_002","aff_003",None,None]
AGENTS = ["agent_001","agent_002",None,None]
START_DATE = datetime.utcnow() - timedelta(days=14)

def rand_ts(day_offset=0):
    dt = START_DATE + timedelta(days=day_offset, hours=random.randint(8,21), minutes=random.randint(0,59))
    return dt.isoformat() + "Z"

def main():
    print("🎲 Generating Phase K dashboard mock data...\n")
    events = []
    for _ in range(NUM_USERS):
        customer_id = f"cust_{uuid.uuid4().hex[:8]}"
        for s_idx in range(random.randint(1, MAX_SESSIONS_PER_USER)):
            session_id = f"sess_{uuid.uuid4().hex[:8]}"
            channel = random.choices(CHANNELS, weights=[30,22,18,12,18], k=1)[0]
            branch_id = random.choices(BRANCHES, weights=[35,25,20,20], k=1)[0]
            proc_id, proc_name, tags = random.choices(PROCEDURES, weights=[28,12,10,18,12,10,10], k=1)[0]
            agent_id = random.choice(AGENTS)
            affiliate_id = random.choice(AFFILIATES)
            affiliate_link_id = f"lnk_{random.randint(1,3):03d}" if affiliate_id else None
            campaign_id = random.choice(["camp_q1","camp_q2","camp_botox"]) if affiliate_id else ""
            day_offset = random.randint(0,13)

            events.append({"event_type":"lead_created","customer_id":customer_id,"session_id":session_id,"channel":channel,"branch_id":branch_id,"procedure_id":proc_id,"procedure_name":proc_name,"agent_id":agent_id,"affiliate_id":affiliate_id,"affiliate_link_id":affiliate_link_id,"campaign_id":campaign_id,"timestamp":rand_ts(day_offset)})
            events.append({"event_type":"procedure_viewed","customer_id":customer_id,"session_id":session_id,"channel":channel,"branch_id":branch_id,"procedure_id":proc_id,"procedure_name":proc_name,"timestamp":rand_ts(day_offset)})

            if random.random() < random.uniform(0.08, 0.14):
                events.append({"event_type":"cta_clicked","customer_id":customer_id,"session_id":session_id,"channel":channel,"branch_id":branch_id,"procedure_id":proc_id,"procedure_name":proc_name,"affiliate_id":affiliate_id,"affiliate_link_id":affiliate_link_id,"campaign_id":campaign_id,"timestamp":rand_ts(day_offset)})
                if random.random() < random.uniform(0.45, 0.70):
                    revenue = random.randint(3500,18000)
                    aff_comm = round(revenue * random.uniform(0.08,0.15),2) if affiliate_id else 0
                    agent_comm = round(revenue * random.uniform(0.03,0.07),2) if agent_id else 0
                    events.append({"event_type":"booking_completed","booking_id":f"bk_{uuid.uuid4().hex[:8]}","booking_status":random.choices(BOOKING_STATUSES,weights=[20,35,35,10],k=1)[0],"customer_id":customer_id,"session_id":session_id,"channel":channel,"branch_id":branch_id,"procedure_id":proc_id,"procedure_name":proc_name,"revenue":revenue,"affiliate_id":affiliate_id,"affiliate_link_id":affiliate_link_id,"campaign_id":campaign_id,"affiliate_commission":aff_comm,"agent_id":agent_id,"agent_commission":agent_comm,"timestamp":rand_ts(day_offset)})

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")

    views = sum(1 for e in events if e["event_type"]=="procedure_viewed")
    clicks = sum(1 for e in events if e["event_type"]=="cta_clicked")
    bookings = sum(1 for e in events if e["event_type"]=="booking_completed")
    sessions = len(set(e["session_id"] for e in events))
    revenue = sum(float(e.get("revenue",0) or 0) for e in events if e["event_type"]=="booking_completed")
    print(f"✅ Generated: {OUTPUT_FILE}")
    print(f"events: {len(events)}, views: {views}, clicks: {clicks}, bookings: {bookings}")
    print(f"ctr: {round(clicks/views,4) if views else 0}, conversion: {round(bookings/sessions,4) if sessions else 0}, revenue: {round(revenue,2)}")

if __name__ == "__main__":
    main()
