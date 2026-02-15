/**
 * GET /api/clinic/promotions/[id]/cover
 * Stream the promotion cover image from Firebase Storage so the list can display it
 * (Storage URL may not be publicly loadable in the browser).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId, getPromotionById } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { downloadStorageUrlToBuffer } from "@/lib/promotion-storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: promotionId } = await params;
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const user = await getEffectiveUser(session);

  const promotion = await getPromotionById(orgId, promotionId);
  if (!promotion) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, promotion.branchIds[0] ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const mediaUrl = promotion.media?.[0]?.url;
  if (!mediaUrl || promotion.media?.[0]?.type !== "image") {
    return NextResponse.json({ error: "No cover image" }, { status: 404 });
  }

  const result = await downloadStorageUrlToBuffer(mediaUrl);
  if (!result) {
    return NextResponse.json({ error: "Could not load image" }, { status: 502 });
  }

  return new NextResponse(result.buffer, {
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}
