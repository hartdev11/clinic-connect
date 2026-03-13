/**
 * Phase 20B — PUT /api/admin/organizations/[orgId]/activate
 * super_admin only — set org status = active
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const guard = await requireSuperAdminSession();
  if (!guard.ok) return guard.response;
  const { orgId } = await params;
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  try {
    const orgRef = db.collection("organizations").doc(orgId);
    const orgDoc = await orgRef.get();
    if (!orgDoc.exists) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    await orgRef.update({
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ success: true, orgId, status: "active" });
  } catch (err) {
    console.error("PUT /api/admin/organizations/[orgId]/activate:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
