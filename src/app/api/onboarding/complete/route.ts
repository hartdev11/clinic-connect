/**
 * POST /api/onboarding/complete — Finalize onboarding
 * 1. Create TenantConfig
 * 2. Enqueue embedding jobs for all clinic services
 * 3. Trigger embedding worker
 * 4. Return success
 */
import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { createTenantConfig } from "@/lib/onboarding";
import { listClinicServices } from "@/lib/unified-knowledge/data";
import { enqueueUnifiedServiceEmbed } from "@/lib/knowledge-brain/embedding-queue";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  try {
    await createTenantConfig(orgId);

    const services = await listClinicServices(orgId, { limit: 200 });
    for (const s of services) {
      await enqueueUnifiedServiceEmbed(orgId, s.id);
    }

    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXTAUTH_URL || "http://localhost:3000";
    const cronSecret = process.env.CRON_SECRET;
    const res = await fetch(`${base}/api/admin/embedding-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}),
      },
    });
    if (!res.ok) {
      console.warn("Embedding worker call failed:", await res.text());
    }

    return NextResponse.json({
      ok: true,
      servicesEnqueued: services.length,
    });
  } catch (err) {
    console.error("POST /api/onboarding/complete:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
