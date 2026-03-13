/**
 * Phase 24 — Platform Config API (super_admin only)
 * GET: read config, PATCH: update config
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getUserById } from "@/lib/clinic-data";
import { getPlatformConfig, updatePlatformConfig } from "@/lib/learning/platform-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user_id ?? session.clinicId;
  const user = userId ? await getUserById(userId) : null;
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getPlatformConfig();
  return NextResponse.json(config);
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user_id ?? session.clinicId;
  const user = userId ? await getUserById(userId) : null;
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (typeof body.minQualityScoreForAutoApprove === "number" && body.minQualityScoreForAutoApprove >= 0 && body.minQualityScoreForAutoApprove <= 1) {
      updates.minQualityScoreForAutoApprove = body.minQualityScoreForAutoApprove;
    }
    if (typeof body.minQualityScoreForQueue === "number" && body.minQualityScoreForQueue >= 0 && body.minQualityScoreForQueue <= 1) {
      updates.minQualityScoreForQueue = body.minQualityScoreForQueue;
    }
    if (Array.isArray(body.globalProhibitedClaims)) {
      updates.globalProhibitedClaims = body.globalProhibitedClaims.filter(
        (x: unknown) => typeof x === "string" && x.trim().length > 0
      );
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }
    await updatePlatformConfig(updates as Parameters<typeof updatePlatformConfig>[0]);
    const config = await getPlatformConfig();
    return NextResponse.json(config);
  } catch (err) {
    console.error("PATCH /api/admin/platform-config:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
