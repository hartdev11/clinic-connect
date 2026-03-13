/**
 * GET /api/onboarding/step1 — Load current org/branch data for pre-fill
 * PATCH /api/onboarding/step1 — Save Basic Info (auto-save)
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getBranchesByOrgId, getOrgProfile } from "@/lib/clinic-data";
import { getBranchHours } from "@/lib/clinic-data";
import { db } from "@/lib/firebase-admin";
import {
  updateOrgBasicInfo,
  updateBranchAddress,
  updateBranchHoursForOnboarding,
} from "@/lib/onboarding";
import type { DayOfWeek } from "@/types/clinic";

export const dynamic = "force-dynamic";

type DayHours = { open: string; close: string } | null;

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }
  try {
    const [orgProfile, branches] = await Promise.all([
      getOrgProfile(orgId),
      getBranchesByOrgId(orgId),
    ]);
    if (!orgProfile) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgData = orgDoc.exists ? orgDoc.data() : {};
    const branchId = branches[0]?.id;
    const businessHours: Record<string, { open: string; close: string } | null> = {};
    if (branchId) {
      const hours = await getBranchHours(orgId, branchId);
      if (hours) {
        const days: DayOfWeek[] = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        for (const d of days) {
          const v = hours[d];
          businessHours[d] =
            v && typeof v === "object" && "open" in v && "close" in v
              ? { open: String(v.open), close: String(v.close) }
              : d === "sunday"
                ? null
                : { open: "09:00", close: d === "saturday" ? "14:00" : "18:00" };
        }
      }
    }
    const address = branches[0]?.address ?? (orgData?.address as string) ?? "";
    return NextResponse.json({
      clinicName: orgProfile.clinicName,
      address,
      phone: orgProfile.phone,
      lineOA: (orgData?.lineOA as string) ?? "",
      businessHours: Object.keys(businessHours).length ? businessHours : undefined,
      branchId,
    });
  } catch (err) {
    console.error("GET /api/onboarding/step1:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const {
      clinicName,
      address,
      phone,
      lineOA,
      businessHours,
    } = body as {
      clinicName?: string;
      address?: string;
      phone?: string;
      lineOA?: string;
      businessHours?: Record<string, DayHours>;
    };

    if (clinicName !== undefined) {
      await updateOrgBasicInfo(orgId, { clinicName });
    }
    if (address !== undefined || phone !== undefined || lineOA !== undefined) {
      await updateOrgBasicInfo(orgId, { address, phone, lineOA });
    }

    const branches = await getBranchesByOrgId(orgId);
    if (branches.length > 0) {
      const branchId = branches[0].id;
      if (address !== undefined) {
        await updateBranchAddress(orgId, branchId, address ?? "");
      }
      if (businessHours && typeof businessHours === "object") {
        const days: DayOfWeek[] = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        const hours: Partial<Record<DayOfWeek, DayHours>> = {};
        for (const d of days) {
          if (d in businessHours) hours[d] = businessHours[d];
        }
        await updateBranchHoursForOnboarding(orgId, branchId, hours);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/onboarding/step1:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
