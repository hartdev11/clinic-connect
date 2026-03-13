/**
 * Phase 20B — PUT /api/admin/organizations/[orgId]/suspend
 * super_admin only — set org status = suspended, notify owner
 */
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminSession } from "@/lib/admin-super-guard";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotification } from "@/lib/notifications/notification-service";

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
    const orgName = (orgDoc.data()?.name as string) ?? "องค์กร";
    await orgRef.update({
      status: "suspended",
      updatedAt: FieldValue.serverTimestamp(),
    });
    await sendNotification(orgId, "org_suspended", {
      title: "บัญชีถูกระงับชั่วคราว",
      message: `องค์กร ${orgName} ถูกระงับชั่วคราวโดยผู้ดูแลระบบ กรุณาติดต่อฝ่ายสนับสนุน`,
      severity: "urgent",
      actionUrl: "/clinic",
    }).catch((e) =>
      console.warn("[Suspend] notify owner:", (e as Error)?.message?.slice(0, 80))
    );
    return NextResponse.json({ success: true, orgId, status: "suspended" });
  } catch (err) {
    console.error("PUT /api/admin/organizations/[orgId]/suspend:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
