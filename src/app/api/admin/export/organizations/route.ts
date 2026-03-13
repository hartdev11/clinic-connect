/**
 * Phase 20B — GET /api/admin/export/organizations
 * super_admin only — export CSV ของทุก org
 */
import { NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function escapeCsv(val: string | number | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  try {
    const snap = await db.collection("organizations").limit(2000).get();
    const headers = [
      "id",
      "name",
      "displayName",
      "email",
      "plan",
      "status",
      "agencyId",
      "createdAt",
      "updatedAt",
    ];
    const rows: string[][] = [headers];
    for (const doc of snap.docs) {
      const d = doc.data();
      const created = d.createdAt?.toDate?.()?.toISOString?.() ?? d.createdAt ?? "";
      const updated = d.updatedAt?.toDate?.()?.toISOString?.() ?? d.updatedAt ?? "";
      rows.push([
        doc.id,
        escapeCsv(d.name),
        escapeCsv(d.displayName),
        escapeCsv(d.email),
        escapeCsv(d.plan ?? "starter"),
        escapeCsv(d.status ?? "active"),
        escapeCsv(d.agencyId),
        escapeCsv(created),
        escapeCsv(updated),
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="organizations.csv"',
      },
    });
  } catch (err) {
    console.error("GET /api/admin/export/organizations:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
