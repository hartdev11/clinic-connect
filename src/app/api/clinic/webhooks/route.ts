/**
 * Phase 19 — Partner/White-label webhook configs
 * GET: list webhook configs ของ org
 * POST: สร้าง webhook endpoint
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireRole } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const VALID_EVENTS = ["booking.created", "handoff.created", "lead.hot"] as const;

/** GET — รายการ webhook configs ของ org */
export async function GET(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "จำกัดสิทธิ์" }, { status: 403 });
    }

    const snap = await db
      .collection("organizations")
      .doc(orgId)
      .collection("webhook_configs")
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        url: data.url ?? "",
        events: (data.events as string[]) ?? [],
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return NextResponse.json({ items });
  } catch (err) {
    console.error("GET /api/clinic/webhooks:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}

/** POST — สร้าง webhook config */
export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager"])) {
      return NextResponse.json({ error: "จำกัดสิทธิ์" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const events = Array.isArray(body.events)
      ? (body.events as string[]).filter((e) => VALID_EVENTS.includes(e as (typeof VALID_EVENTS)[number]))
      : [];

    if (!url.startsWith("https://")) {
      return NextResponse.json({ error: "URL ต้องเป็น https" }, { status: 400 });
    }
    if (events.length === 0) {
      return NextResponse.json({ error: "กรุณาเลือกอย่างน้อย 1 event" }, { status: 400 });
    }

    const secret = crypto.randomBytes(32).toString("hex");
    const { FieldValue } = await import("firebase-admin/firestore");

    const docRef = await db
      .collection("organizations")
      .doc(orgId)
      .collection("webhook_configs")
      .add({
        url,
        events,
        secret,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      id: docRef.id,
      url,
      events,
      isActive: true,
      /** ส่ง secret เฉพาะครั้งแรก — เก็บไว้ใช้ verify signature */
      secret,
    });
  } catch (err) {
    console.error("POST /api/clinic/webhooks:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
