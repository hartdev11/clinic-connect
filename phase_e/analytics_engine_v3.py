
from metrics_aggregator import aggregate

def run():
    m = aggregate()
    sessions = m["sessions"]
    clicks = m["clicks"]
    bookings = m["bookings"]
    revenue = m["revenue"]

    ctr = clicks / sessions if sessions else 0
    conversion = bookings / sessions if sessions else 0

    cta_performance = {}
    for cta_id, count in m["cta_clicks"].items():
        booked = m["cta_bookings"].get(cta_id, 0)
        cta_performance[cta_id] = {
            "clicks": count,
            "bookings": booked,
            "conversion": booked / count if count else 0
        }

    return {
        "ctr": ctr,
        "conversion": conversion,
        "revenue": revenue,
        "sessions": sessions,
        "bookings": bookings,
        "cta_performance": cta_performance
    }

if __name__ == "__main__":
    r = run()
    print(f"CTR: {r['ctr']:.2%}")
    print(f"Conversion: {r['conversion']:.2%}")
    print(f"Revenue: {r['revenue']}")
