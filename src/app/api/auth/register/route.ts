import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { hashPassword } from "@/lib/auth";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTIONS = {
  organizations: "organizations",
  branches: "branches",
  users: "users",
  clinics: "clinics", // legacy: ตรวจซ้ำ email
} as const;

function validateLicenseKey(key: string): boolean {
  return key.trim().length >= 8;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      licenseKey,
      clinicName,
      branches,
      phone,
      email,
      password,
    } = body as {
      licenseKey?: string;
      clinicName?: string;
      branches?: string | number;
      phone?: string;
      email?: string;
      password?: string;
    };

    if (!licenseKey?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอก License Key" },
        { status: 400 }
      );
    }
    if (!validateLicenseKey(licenseKey)) {
      return NextResponse.json(
        { error: "License Key ไม่ถูกต้อง (อย่างน้อย 8 ตัวอักษร)" },
        { status: 400 }
      );
    }
    if (!clinicName?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกชื่อคลินิก" },
        { status: 400 }
      );
    }
    if (!email?.trim()) {
      return NextResponse.json(
        { error: "กรุณากรอกอีเมลเจ้าของ" },
        { status: 400 }
      );
    }
    if (!password?.trim() || password.length < 6) {
      return NextResponse.json(
        { error: "กรุณากรอกรหัสผ่านอย่างน้อย 6 ตัว" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const keyTrimmed = licenseKey.trim();

    // E1.7 — ตรวจซ้ำ: email ใน users (org-first) หรือ clinics (legacy)
    const existingUser = await db
      .collection(COLLECTIONS.users)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingUser.empty) {
      return NextResponse.json(
        { error: "อีเมลนี้มีการสมัครแล้ว" },
        { status: 400 }
      );
    }

    const existingClinic = await db
      .collection(COLLECTIONS.clinics)
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!existingClinic.empty) {
      return NextResponse.json(
        { error: "อีเมลนี้มีการสมัครแล้ว" },
        { status: 400 }
      );
    }

    const existingOrg = await db
      .collection(COLLECTIONS.organizations)
      .where("licenseKey", "==", keyTrimmed)
      .limit(1)
      .get();

    if (!existingOrg.empty) {
      return NextResponse.json(
        { error: "License Key นี้ถูกใช้งานแล้ว" },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const now = FieldValue.serverTimestamp();

    const result = await db.runTransaction(async (tx) => {
      const orgRef = db.collection(COLLECTIONS.organizations).doc();
      const branchRef = db.collection(COLLECTIONS.branches).doc();
      const userRef = db.collection(COLLECTIONS.users).doc();

      tx.set(orgRef, {
        name: clinicName.trim(),
        plan: "starter",
        phone: phone?.trim() ?? "",
        email: normalizedEmail,
        licenseKey: keyTrimmed,
        createdAt: now,
        updatedAt: now,
        affiliate_id: null,
        white_label_config: null,
      });

      tx.set(branchRef, {
        org_id: orgRef.id,
        name: "สาขาหลัก",
        address: "",
        createdAt: now,
        updatedAt: now,
      });

      tx.set(userRef, {
        org_id: orgRef.id,
        email: normalizedEmail,
        passwordHash,
        role: "owner",
        default_branch_id: branchRef.id,
        createdAt: now,
        updatedAt: now,
      });

      return { orgId: orgRef.id, branchId: branchRef.id };
    });

    return NextResponse.json({
      success: true,
      orgId: result.orgId,
      branchId: result.branchId,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Register error:", err);
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
