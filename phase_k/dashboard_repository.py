from __future__ import annotations
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any, Dict, List, Optional, Tuple
from db_config import get_firestore_client

@dataclass
class DashboardFilters:
    tenant_id: Optional[str] = None
    clinic_id: Optional[str] = None
    branch_id: Optional[str] = None
    affiliate_id: Optional[str] = None
    agent_id: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None

class DashboardRepository:
    COLLECTIONS = {
        "organizations": "organizations",
        "branches": "branches",
        "customers": "customers",
        "bookings": "bookings",
        "payments": "payments",
        "line_webhook_events": "line_webhook_events",
    }

    def __init__(self, db=None):
        self.db = db or get_firestore_client()

    @staticmethod
    def _safe_float(v):
        try: return float(v or 0)
        except: return 0.0

    @staticmethod
    def _safe_rate(num, den):
        if not den: return 0.0
        return round(float(num) / float(den), 4)

    @staticmethod
    def _normalize_text(v):
        if v is None: return ""
        return str(v).strip()

    @staticmethod
    def _to_datetime(value):
        if value is None: return None
        if isinstance(value, datetime): return value
        if isinstance(value, date): return datetime.combine(value, time.min)
        if hasattr(value, "to_datetime"):
            try: return value.to_datetime()
            except: pass
        if hasattr(value, "timestamp"):
            try:
                from datetime import timezone
                return datetime.fromtimestamp(value.timestamp(), tz=timezone.utc)
            except: pass
        if isinstance(value, str):
            try: return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except: return None
        return None

    def _get_doc_time(self, doc):
        for field in ["createdAt", "created_at", "scheduledAt"]:
            dt = self._to_datetime(doc.get(field))
            if dt is not None: return dt
        return None

    def _parse_date_range(self, filters):
        date_from = self._to_datetime(filters.date_from) if filters.date_from else None
        date_to = self._to_datetime(filters.date_to) if filters.date_to else None
        if date_from: date_from = date_from.replace(hour=0, minute=0, second=0, microsecond=0)
        if date_to: date_to = date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
        return date_from, date_to

    def _collection(self, key):
        return self.db.collection(self.COLLECTIONS[key])

    def _query_org_rows(self, key, filters):
        query = self._collection(key)
        if filters.tenant_id:
            query = query.where("org_id", "==", filters.tenant_id)
        if filters.branch_id and key == "bookings":
            query = query.where("branch_id", "==", filters.branch_id)
        rows = []
        date_from, date_to = self._parse_date_range(filters)
        for doc in query.stream():
            data = doc.to_dict() or {}
            data["id"] = doc.id
            doc_time = self._get_doc_time(data)
            if date_from and doc_time:
                t = doc_time.replace(tzinfo=None) if doc_time.tzinfo else doc_time
                f = date_from.replace(tzinfo=None) if date_from.tzinfo else date_from
                if t < f: continue
            if date_to and doc_time:
                t = doc_time.replace(tzinfo=None) if doc_time.tzinfo else doc_time
                d = date_to.replace(tzinfo=None) if date_to.tzinfo else date_to
                if t > d: continue
            rows.append(data)
        return rows

    def _load_bookings(self, filters):
        rows = self._query_org_rows("bookings", filters)
        if filters.branch_id:
            return [r for r in rows if (r.get("branch_id") or r.get("branchId")) == filters.branch_id]
        return rows

    def _load_customers(self, filters):
        return self._query_org_rows("customers", filters)

    def _load_branches(self, filters):
        return self._query_org_rows("branches", filters)

    def _load_webhook_events(self, filters):
        try: return self._query_org_rows("line_webhook_events", filters)
        except: return []

    def get_overview_metrics(self, filters):
        customers = self._load_customers(filters)
        bookings = self._load_bookings(filters)
        webhook_events = self._load_webhook_events(filters)
        customer_ids = set()
        for row in customers:
            eid = row.get("externalId") or row.get("id")
            if eid: customer_ids.add(eid)
        booking_customer_ids = set()
        for row in bookings:
            cid = row.get("customerId")
            if cid: booking_customer_ids.add(cid)
        session_ids = set()
        for row in webhook_events:
            candidate = row.get("session_id") or row.get("conversation_id") or row.get("event_id") or row.get("id")
            if candidate: session_ids.add(candidate)
        if not session_ids:
            for row in bookings:
                cid = row.get("customerId")
                if cid: session_ids.add(cid)
            for row in customers:
                eid = row.get("externalId") or row.get("id")
                if eid: session_ids.add(eid)
        total_revenue = 0.0
        total_bookings = 0
        for row in bookings:
            status = self._normalize_text(row.get("status")).lower()
            amount = self._safe_float(row.get("amount"))
            if status in {"confirmed","completed","paid","success"}:
                total_revenue += amount
            total_bookings += 1
        total_users = len(customer_ids) if customer_ids else len(booking_customer_ids)
        total_sessions = len(session_ids)
        total_leads = len(customer_ids)
        raw_conversion = self._safe_rate(total_bookings, total_sessions)
        data_quality_flags = []
        if raw_conversion > 1.0:
            data_quality_flags.append("session_definition_incomplete")
        return {
            "total_users": total_users,
            "total_sessions": total_sessions,
            "total_leads": total_leads,
            "total_bookings": total_bookings,
            "total_revenue": round(total_revenue, 2),
            "conversion_rate": min(raw_conversion, 1.0),
            "ctr": 0.0,
            "data_quality_flags": data_quality_flags,
        }

    def get_funnel_metrics(self, filters):
        customers = self._load_customers(filters)
        bookings = self._load_bookings(filters)
        views = len(customers)
        clicks = sum(1 for r in customers if r.get("aiResponded") is True or self._normalize_text(r.get("source")))
        return {"view": views, "click": clicks, "booking": len(bookings)}

    def get_top_procedures(self, filters, limit=10):
        bookings = self._load_bookings(filters)
        grouped = {}
        for row in bookings:
            proc_name = self._normalize_text(row.get("procedure")) or self._normalize_text(row.get("service")) or "Unknown"
            key = proc_name.lower()
            bucket = grouped.setdefault(key, {"procedure_id":key,"procedure_name":proc_name,"views":0,"bookings":0,"revenue":0.0})
            bucket["views"] += 1
            bucket["bookings"] += 1
            if self._normalize_text(row.get("status")).lower() in {"confirmed","completed","paid","success"}:
                bucket["revenue"] += self._safe_float(row.get("amount"))
        output = list(grouped.values())
        for r in output:
            r["revenue"] = round(r["revenue"], 2)
            r["conversion_rate"] = self._safe_rate(r["bookings"], r["views"])
        output.sort(key=lambda x: (x["revenue"], x["bookings"]), reverse=True)
        return output[:limit]

    def get_top_channels(self, filters, limit=10):
        bookings = self._load_bookings(filters)
        grouped = {}
        for row in bookings:
            ch = self._normalize_text(row.get("channel")) or self._normalize_text(row.get("source")) or "unknown"
            bucket = grouped.setdefault(ch, {"channel":ch,"sessions":0,"bookings":0,"revenue":0.0})
            bucket["sessions"] += 1
            bucket["bookings"] += 1
            if self._normalize_text(row.get("status")).lower() in {"confirmed","completed","paid","success"}:
                bucket["revenue"] += self._safe_float(row.get("amount"))
        output = list(grouped.values())
        for r in output:
            r["revenue"] = round(r["revenue"], 2)
            r["conversion_rate"] = self._safe_rate(r["bookings"], r["sessions"])
        output.sort(key=lambda x: (x["revenue"], x["bookings"]), reverse=True)
        return output[:limit]

    def get_recent_bookings(self, filters, limit=20):
        bookings = self._load_bookings(filters)
        bookings.sort(key=lambda r: self._get_doc_time(r) or datetime.min, reverse=True)
        output = []
        for row in bookings[:limit]:
            output.append({
                "booking_id": row.get("id"),
                "customer_id": row.get("customerId"),
                "procedure_id": self._normalize_text(row.get("procedure")).lower() or None,
                "procedure_name": row.get("procedure") or row.get("service"),
                "status": row.get("status"),
                "booking_date": str(row.get("scheduledAt") or ""),
                "revenue": self._safe_float(row.get("amount")),
                "created_at": str(row.get("createdAt") or ""),
                "channel": row.get("channel"),
                "branch_id": row.get("branch_id") or row.get("branchId"),
                "branch_name": row.get("branchName"),
            })
        return output

    def get_booking_status_summary(self, filters):
        bookings = self._load_bookings(filters)
        summary = {"pending":0,"confirmed":0,"completed":0,"cancelled":0}
        for row in bookings:
            status = self._normalize_text(row.get("status")).lower()
            if status in summary: summary[status] += 1
        return summary

    def get_customer_summary(self, filters):
        customers = self._load_customers(filters)
        summary = {"new_customers":0,"returning_customers":0,"hot_leads":0,"warm_leads":0,"cold_leads":0}
        for row in customers:
            status = self._normalize_text(row.get("status")).lower()
            if status in {"new","lead","prospect"}: summary["new_customers"] += 1
            else: summary["returning_customers"] += 1
            if row.get("aiResponded") is True: summary["hot_leads"] += 1
            elif self._normalize_text(row.get("source")): summary["warm_leads"] += 1
            else: summary["cold_leads"] += 1
        return summary

    def get_affiliate_summary(self, filters):
        bookings = self._load_bookings(filters)
        total_revenue = sum(self._safe_float(r.get("amount")) for r in bookings if self._normalize_text(r.get("status")).lower() in {"confirmed","completed","paid","success"})
        return {
            "total_clicks": 0,
            "total_leads": len({r.get("customerId") for r in bookings if r.get("customerId")}),
            "total_bookings": len(bookings),
            "total_revenue": round(total_revenue, 2),
            "total_commission": 0.0,
            "top_links": [],
            "data_quality_flags": ["affiliate_collection_not_mapped"],
        }

    def get_agent_summary(self, filters):
        customers = self._load_customers(filters)
        bookings = self._load_bookings(filters)
        return {
            "total_leads": len(customers),
            "total_bookings": len(bookings),
            "close_rate": self._safe_rate(len(bookings), len(customers)),
            "total_revenue": round(sum(self._safe_float(r.get("amount")) for r in bookings), 2),
            "total_commission": 0.0,
            "top_agents": [],
            "data_quality_flags": ["agent_collection_not_mapped"],
        }

    def get_branch_performance(self, filters):
        branches = self._load_branches(filters)
        bookings = self._load_bookings(filters)
        grouped = {}
        for b in branches:
            bid = b.get("id","")
            grouped[bid] = {"branch_id":bid,"branch_name":b.get("name",""),"sessions":0,"bookings":0,"revenue":0.0}
        for row in bookings:
            bid = row.get("branch_id") or row.get("branchId","unknown")
            bucket = grouped.setdefault(bid, {"branch_id":bid,"branch_name":row.get("branchName",bid),"sessions":0,"bookings":0,"revenue":0.0})
            bucket["bookings"] += 1
            if self._normalize_text(row.get("status")).lower() in {"confirmed","completed","paid","success"}:
                bucket["revenue"] += self._safe_float(row.get("amount"))
        result = []
        for row in grouped.values():
            row["revenue"] = round(row["revenue"], 2)
            row["conversion_rate"] = self._safe_rate(row["bookings"], row["sessions"])
            result.append(row)
        return sorted(result, key=lambda x: x["revenue"], reverse=True)

    def get_daily_trend(self, filters):
        bookings = self._load_bookings(filters)
        customers = self._load_customers(filters)
        daily = {}
        for d in customers:
            dt = self._get_doc_time(d)
            if dt:
                day = dt.strftime("%Y-%m-%d")
                daily.setdefault(day, {"date":day,"revenue":0.0,"bookings":0,"sessions":0})
                daily[day]["sessions"] += 1
        for d in bookings:
            dt = self._get_doc_time(d)
            if dt:
                day = dt.strftime("%Y-%m-%d")
                daily.setdefault(day, {"date":day,"revenue":0.0,"bookings":0,"sessions":0})
                daily[day]["bookings"] += 1
                if self._normalize_text(d.get("status")).lower() in {"confirmed","completed","paid","success"}:
                    daily[day]["revenue"] += self._safe_float(d.get("amount"))
        for row in daily.values():
            row["revenue"] = round(row["revenue"], 2)
        return sorted(daily.values(), key=lambda x: x["date"])


def get_dashboard_repository():
    return DashboardRepository()


if __name__ == "__main__":
    print("=== DASHBOARD REPOSITORY TEST ===\n")
    try:
        repo = get_dashboard_repository()
        filters = DashboardFilters()
        print("OVERVIEW:")
        overview = repo.get_overview_metrics(filters)
        for k, v in overview.items(): print(f"  {k}: {v}")
        print("\nFUNNEL:")
        funnel = repo.get_funnel_metrics(filters)
        for k, v in funnel.items(): print(f"  {k}: {v}")
        print(f"\nRECENT BOOKINGS: {len(repo.get_recent_bookings(filters, limit=5))} records")
        print(f"TOP PROCEDURES: {len(repo.get_top_procedures(filters))} records")
        print(f"TOP CHANNELS: {len(repo.get_top_channels(filters))} records")
        print(f"BRANCH PERFORMANCE: {len(repo.get_branch_performance(filters))} records")
        print(f"DAILY TREND: {len(repo.get_daily_trend(filters))} days")
        print(f"BOOKING SUMMARY: {repo.get_booking_status_summary(filters)}")
        webhook = repo._load_webhook_events(filters)
        print(f"\nLINE WEBHOOK EVENTS: {len(webhook)} records")
        print("  (session fact available)" if webhook else "  (empty - fallback to customers/bookings)")
        print("\nOK: Repository working with real Firestore")
    except Exception as e:
        import traceback
        print(f"ERROR: {e}")
        traceback.print_exc()
