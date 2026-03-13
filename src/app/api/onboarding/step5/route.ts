/**
 * PATCH /api/onboarding/step5 — Save AI Persona & Style
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { saveAiConfigSettings } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

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
      clinic_style,
      ai_tone,
      usp,
      competitors,
      greeting_message,
      fallback_message,
      handoff_message,
    } = body as {
      clinic_style?: "luxury" | "budget" | "friendly";
      ai_tone?: "formal" | "casual" | "fun";
      usp?: string;
      competitors?: string[];
      greeting_message?: string;
      fallback_message?: string;
      handoff_message?: string;
    };

    const validStyles = ["luxury", "budget", "friendly"] as const;
    const validTones = ["formal", "casual", "fun"] as const;

    await saveAiConfigSettings(orgId, {
      clinic_style: clinic_style && validStyles.includes(clinic_style) ? clinic_style : "friendly",
      ai_tone: ai_tone && validTones.includes(ai_tone) ? ai_tone : "casual",
      usp: typeof usp === "string" ? usp : "",
      competitors: Array.isArray(competitors) ? competitors.filter((c) => typeof c === "string") : [],
      greeting_message: typeof greeting_message === "string" ? greeting_message : "",
      fallback_message: typeof fallback_message === "string" ? fallback_message : "",
      handoff_message: typeof handoff_message === "string" ? handoff_message : "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/onboarding/step5:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
