/**
 * POST /api/admin/ai-cache-invalidate
 * Admin only — ลบ AI response cache (เมื่อ knowledge/promo/prompt เปลี่ยน)
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { invalidateAICache } from "@/lib/ai/ai-feedback-loop";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const org_id = body.org_id as string | undefined;
    const deleted = await invalidateAICache({ org_id, scope: org_id ? "org" : "all" });
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("POST /api/admin/ai-cache-invalidate:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
