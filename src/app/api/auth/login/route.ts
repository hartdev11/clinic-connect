import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyPassword } from "@/lib/auth";
import {
  createToken,
  getCookieOptions,
  COOKIE_NAME,
} from "@/lib/session";
import {
  getOrgIdFromClinicId,
  getDefaultBranchId,
} from "@/lib/clinic-data";
import { writeAuditLog } from "@/lib/audit-log";
import { log } from "@/lib/logger";
import { isLikelyBot, getClientUserAgent } from "@/lib/bot-detection";

const COLLECTIONS = {
  organizations: "organizations",
  users: "users",
  clinics: "clinics",
} as const;

export async function POST(request: NextRequest) {
  try {
    if (isLikelyBot(getClientUserAgent(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { licenseKey, email, password } = body as {
      licenseKey?: string;
      email?: string;
      password?: string;
    };

    if (!licenseKey?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอก License Key" },
        { status: 400 }
      );
    }
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมล" },
        { status: 400 }
      );
    }
    if (!password?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสผ่าน" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const keyTrimmed = licenseKey.trim();

    // E1.7 — ลอง org-first ก่อน (users + organizations)
    const orgSnap = await db
      .collection(COLLECTIONS.organizations)
      .where("licenseKey", "==", keyTrimmed)
      .limit(1)
      .get();

    if (!orgSnap.empty) {
      const orgDoc = orgSnap.docs[0];
      const orgId = orgDoc.id;

      const userSnap = await db
        .collection(COLLECTIONS.users)
        .where("org_id", "==", orgId)
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        const userId = userDoc.id;

        const match = await verifyPassword(password, userData.passwordHash);
        if (match) {
          const branchId =
            userData.default_branch_id ||
            (await getDefaultBranchId(orgId));

          const token = await createToken({
            sub: userId,
            email: normalizedEmail,
            org_id: orgId,
            branch_id: branchId ?? null,
            user_id: userId,
          });

          writeAuditLog({
            event: "login",
            org_id: orgId,
            user_id: userId,
            email: normalizedEmail,
          }).catch(() => {});

          const response = NextResponse.json({ success: true });
          response.cookies.set(COOKIE_NAME, token, getCookieOptions());
          return response;
        }
        writeAuditLog({
          event: "failed_auth",
          org_id: orgId,
          email: normalizedEmail,
          details: { reason: "password_mismatch", source: "org_user" },
        }).catch(() => {});
      }
    }

    // Fallback — Legacy clinic flow (ก่อน migration / dual-read)
    const clinicSnap = await db
      .collection(COLLECTIONS.clinics)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (clinicSnap.empty) {
      writeAuditLog({
        event: "failed_auth",
        email: normalizedEmail,
        details: { reason: "clinic_not_found" },
      }).catch(() => {});
      return NextResponse.json(
        { error: "อีเมลหรือ License Key ไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const clinicDoc = clinicSnap.docs[0];
    const clinicData = clinicDoc.data();
    const clinicId = clinicDoc.id;

    if (clinicData.licenseKey !== keyTrimmed) {
      writeAuditLog({
        event: "failed_auth",
        email: normalizedEmail,
        details: { reason: "license_mismatch" },
      }).catch(() => {});
      return NextResponse.json(
        { error: "อีเมลหรือ License Key ไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const match = await verifyPassword(password, clinicData.passwordHash);
    if (!match) {
      writeAuditLog({
        event: "failed_auth",
        email: normalizedEmail,
        details: { reason: "password_mismatch" },
      }).catch(() => {});
      return NextResponse.json(
        { error: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    const orgId = await getOrgIdFromClinicId(clinicId);
    const branchId = orgId ? await getDefaultBranchId(orgId) : null;

    const token = await createToken({
      sub: clinicId,
      email: normalizedEmail,
      org_id: orgId ?? null,
      branch_id: branchId ?? null,
      user_id: null,
    });

    writeAuditLog({
      event: "login",
      org_id: orgId ?? undefined,
      email: normalizedEmail,
      details: { source: "legacy_clinic" },
    }).catch(() => {});

    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, getCookieOptions());
    return response;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error("Login error", err as Error, { route: "/api/auth/login" });
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
