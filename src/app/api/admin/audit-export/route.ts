/**
 * Audit Export — Enterprise Compliance
 * GET /api/admin/audit-export?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=500
 * Admin only — export audit logs for compliance
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";

const COLLECTION = "audit_logs";
const MAX_LIMIT = 1000;

function toISO(t: Timestamp | Date | { toDate?: () => Date } | string): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = "toDate" in t && typeof t.toDate === "function" ? t.toDate() : null;
  return d ? d.toISOString() : String(t);
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const orgId = searchParams.get("org_id");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, MAX_LIMIT);
    const format = searchParams.get("format") || "json";

    const q = db.collection(COLLECTION).orderBy("timestamp", "desc").limit(Math.min(limit * 3, 500));
    const snap = await q.get();
    let items = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        event: d.event,
        org_id: d.org_id ?? null,
        user_id: d.user_id ?? null,
        email: d.email ?? null,
        ip: d.ip ?? null,
        timestamp: d.timestamp ? toISO(d.timestamp) : null,
        details: d.details ?? null,
      };
    });

    const startDate = start ? new Date(start).getTime() : 0;
    const endDate = end ? new Date(end).setHours(23, 59, 59, 999) : Infinity;
    if (start || end) {
      items = items.filter((r) => {
        const ts = r.timestamp ? new Date(r.timestamp).getTime() : 0;
        return ts >= startDate && ts <= endDate;
      });
    }
    if (orgId) {
      items = items.filter((r) => r.org_id === orgId);
    }
    items = items.slice(0, limit);

    if (format === "csv") {
      const header = "id,event,org_id,user_id,email,ip,timestamp,details\n";
      const rows = items.map(
        (r) =>
          `${r.id},${r.event},${r.org_id ?? ""},${r.user_id ?? ""},${r.email ?? ""},${r.ip ?? ""},${r.timestamp ?? ""},"${JSON.stringify(r.details ?? {}).replace(/"/g, '""')}"`
      );
      return new NextResponse(header + rows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="audit_export_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      items,
      total: items.length,
      exported_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/admin/audit-export:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
