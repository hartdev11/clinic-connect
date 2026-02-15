/**
 * POST /api/clinic/promotions/upload-temp
 * Upload image to temporary path: clinics/{orgId}/promotions/_temp/{uploadId}.{ext}
 * Returns { url, uploadId, ext } for use in scan-image and from-scan.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { getEffectiveUser, requireBranchAccess } from "@/lib/rbac";
import { storage, getStorageBucket } from "@/lib/firebase-admin";
import { randomUUID } from "crypto";
import { getTempPath } from "@/lib/promotion-storage";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
  if (!orgId) return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  const user = await getEffectiveUser(session);
  if (!requireBranchAccess(user.role, user.branch_ids, user.branch_roles, session.branch_id ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!ALLOWED_IMAGE.includes(contentType)) {
    return NextResponse.json(
      { error: "Allowed: image (jpeg, png, webp, gif)" },
      { status: 400 }
    );
  }

  const uploadId = randomUUID();
  const ext =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/png"
        ? "png"
        : contentType === "image/webp"
          ? "webp"
          : "gif";
  const storagePath = getTempPath(orgId, uploadId, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const bucket = storage.bucket(getStorageBucket());
    const fileRef = bucket.file(storagePath);
    await fileRef.save(buffer, {
      contentType,
      metadata: { cacheControl: "private, max-age=3600" },
    });
    await fileRef.makePublic();
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media`;
    return NextResponse.json({ url: publicUrl, uploadId, ext });
  } catch (err) {
    console.error("[promotions/upload-temp] error:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Upload failed" },
      { status: 500 }
    );
  }
}
