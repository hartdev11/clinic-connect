/**
 * Franchise: สาขาหลักอนุมัติ/ปฏิเสธคำขอเข้าร่วมของสาขาย่อย
 * POST body: { requestId: string, approve: boolean }
 * เฉพาะเจ้าของสาขาหลัก (session.org_id === request.main_org_id)
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getSessionFromRequest } from "@/lib/auth-session";
import { requireOrgIsolation } from "@/lib/org-isolation";
import { hashPassword } from "@/lib/auth";
import { generateUniqueLicenseKey } from "@/lib/franchise";
import { FRANCHISE_JOIN_REQUESTS_COLLECTION } from "@/types/organization";
import { writeAuditLog } from "@/lib/audit-log";

const COLLECTIONS = {
  organizations: "organizations",
  branches: "branches",
  users: "users",
} as const;

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session?.org_id) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    }

    const body = await request.json();
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const approve = body.approve === true;

    if (!requestId) {
      return NextResponse.json(
        { error: "กรุณาระบุ requestId" },
        { status: 400 }
      );
    }

    const requestRef = db.collection(FRANCHISE_JOIN_REQUESTS_COLLECTION).doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return NextResponse.json(
        { error: "ไม่พบคำขอเข้าร่วม" },
        { status: 404 }
      );
    }

    const reqData = requestSnap.data()!;
    const mainOrgId = reqData.main_org_id as string;
    const requestStatus = reqData.status as string;

    requireOrgIsolation(session, mainOrgId, { resource: "franchise_join_request", id: requestId });

    if (requestStatus !== "pending") {
      return NextResponse.json(
        { error: "คำขอนี้ได้รับการดำเนินการแล้ว" },
        { status: 400 }
      );
    }

    const now = FieldValue.serverTimestamp();

    if (!approve) {
      await requestRef.update({
        status: "rejected",
        rejected_at: now,
        updatedAt: now,
      });
      await writeAuditLog({
        event: "franchise_join_rejected",
        org_id: mainOrgId,
        user_id: session.user_id ?? undefined,
        email: session.email,
        details: { requestId, sub_email: reqData.sub_email },
      }).catch(() => {});
      return NextResponse.json({
        success: true,
        approved: false,
        message: "ปฏิเสธคำขอเข้าร่วมแล้ว",
      });
    }

    const subName = (reqData.sub_name ?? "").toString().trim();
    const subEmail = (reqData.sub_email ?? "").toString().trim().toLowerCase();
    const subAddress = (reqData.sub_address ?? "").toString().trim() || null;
    const subPhone = (reqData.sub_phone ?? "").toString().trim() || null;
    let subPasswordHash = reqData.sub_password_hash as string | undefined;
    let temporaryPassword: string | null = null;
    if (!subPasswordHash) {
      const crypto = await import("crypto");
      temporaryPassword = crypto.randomBytes(12).toString("hex");
      subPasswordHash = await hashPassword(temporaryPassword);
    }

    const mainOrgSnap = await db.collection(COLLECTIONS.organizations).doc(mainOrgId).get();
    if (!mainOrgSnap.exists) {
      return NextResponse.json(
        { error: "ไม่พบองค์กรสาขาหลัก" },
        { status: 404 }
      );
    }
    const mainOrgData = mainOrgSnap.data()!;
    const franchiseGroupId = (mainOrgData.franchise_group_id as string) ?? mainOrgId;
    let subPlan = (mainOrgData.plan as string) ?? "starter";
    const purchaseRecordId = reqData.purchase_record_id as string | undefined;
    if (purchaseRecordId) {
      const { getPurchaseRecordById } = await import("@/lib/purchase-record");
      const purchaseRecord = await getPurchaseRecordById(purchaseRecordId);
      if (purchaseRecord) subPlan = purchaseRecord.plan;
    }

    const subLicenseKey = await generateUniqueLicenseKey();

    const result = await db.runTransaction(async (tx) => {
      const orgRef = db.collection(COLLECTIONS.organizations).doc();
      const branchRef = db.collection(COLLECTIONS.branches).doc();
      const userRef = db.collection(COLLECTIONS.users).doc();

      tx.set(orgRef, {
        name: subName,
        plan: subPlan,
        phone: subPhone ?? "",
        email: subEmail,
        licenseKey: subLicenseKey,
        clinic_type: "franchise",
        franchise_role: "sub",
        franchise_main_org_id: mainOrgId,
        franchise_group_id: franchiseGroupId,
        invite_code: null,
        branch_number: null,
        createdAt: now,
        updatedAt: now,
        affiliate_id: null,
        white_label_config: null,
      });

      tx.set(branchRef, {
        org_id: orgRef.id,
        name: subName,
        address: subAddress ?? "",
        branch_type: "sub",
        createdAt: now,
        updatedAt: now,
      });

      tx.set(userRef, {
        org_id: orgRef.id,
        email: subEmail,
        passwordHash: subPasswordHash,
        role: "owner",
        default_branch_id: branchRef.id,
        createdAt: now,
        updatedAt: now,
      });

      tx.update(requestRef, {
        status: "approved",
        sub_org_id: orgRef.id,
        sub_license_key: subLicenseKey,
        approved_by: session.user_id ?? session.email,
        approved_at: now,
        updatedAt: now,
      });

      return { orgId: orgRef.id, branchId: branchRef.id, licenseKey: subLicenseKey };
    });

    await writeAuditLog({
      event: "franchise_join_approved",
      org_id: mainOrgId,
      user_id: session.user_id ?? undefined,
      email: session.email,
      details: {
        requestId,
        sub_org_id: result.orgId,
        sub_email: subEmail,
      },
    }).catch(() => {});

    const { sendFranchiseSubApprovedEmail } = await import("@/lib/email");
    await sendFranchiseSubApprovedEmail({
      to: subEmail,
      subName,
      licenseKey: result.licenseKey,
      temporaryPassword: temporaryPassword ?? undefined,
    }).catch((err) => console.error("Franchise approval email failed:", err));

    return NextResponse.json({
      success: true,
      approved: true,
      message: "อนุมัติคำขอเข้าร่วมแล้ว สาขาย่อยจะได้รับอีเมลพร้อม License Key",
      subOrgId: result.orgId,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "OrgIsolationError") {
      return NextResponse.json(
        { error: "ไม่มีสิทธิ์อนุมัติคำขอนี้" },
        { status: 403 }
      );
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Franchise approve error:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? detail
            : "เกิดข้อผิดพลาด กรุณาลองใหม่",
      },
      { status: 500 }
    );
  }
}
