/**
 * E5.7–E5.9 — Knowledge Input API
 * POST: Structured Input → Duplicate Detection → Conflict Resolution → Save → Embed → Vector DB
 */
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth-session";
import { getOrgIdFromClinicId } from "@/lib/clinic-data";
import { requireRole } from "@/lib/rbac";
import { getEffectiveUser } from "@/lib/rbac";
import { detectDuplicates, processKnowledgeInput } from "@/lib/knowledge-input";
import type { KnowledgeDocumentCreate, ConflictResolution } from "@/types/knowledge";
import { runWithObservability } from "@/lib/observability/run-with-observability";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Embedding + Pinecone อาจใช้เวลา

export async function POST(request: NextRequest) {
  return runWithObservability("/api/clinic/knowledge", request, async () => {
  const session = await getSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orgId = session.org_id ?? (await getOrgIdFromClinicId(session.clinicId));
    if (!orgId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const user = await getEffectiveUser(session);
    if (!requireRole(user.role, ["owner", "manager", "staff"])) {
      return NextResponse.json(
        { error: "จำกัดสิทธิ์: คุณไม่มีสิทธิ์เข้าถึง Knowledge" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const doc = body.doc as KnowledgeDocumentCreate | undefined;
    const conflictResolution = body.conflictResolution as ConflictResolution | undefined;

    if (!doc || !doc.text?.trim() || !doc.topic || !doc.category) {
      return NextResponse.json(
        { error: "Invalid input: doc.topic, doc.category, doc.text required" },
        { status: 400 }
      );
    }

    const input: KnowledgeDocumentCreate = {
      level: doc.level ?? "org",
      org_id: doc.org_id ?? orgId,
      branch_id: doc.branch_id ?? null,
      topic: doc.topic,
      category: doc.category,
      key_points: Array.isArray(doc.key_points) ? doc.key_points : [],
      text: doc.text,
      expires_at: doc.expires_at ?? null,
      is_active: doc.is_active ?? true,
      archived_at: doc.archived_at ?? null,
      source: doc.source ?? "manual",
    };

    const result = await processKnowledgeInput(input, {
      org_id: orgId,
      conflictResolution,
    });

    if (result.status === "needs_resolution") {
      return NextResponse.json({
        status: "needs_resolution",
        duplicate: result.duplicate,
        message:
          result.duplicate?.type === "exact"
            ? "พบข้อความซ้ำ exactly — เลือก Replace / Keep / Cancel"
            : `พบข้อความคล้ายกัน (similarity ${((result.duplicate?.score ?? 0) * 100).toFixed(0)}%) — เลือก Replace / Keep / Cancel`,
      });
    }

    return {
      response: NextResponse.json({
        status: result.status,
        id: result.id,
        message:
          result.status === "saved"
            ? "บันทึกและ embed สำเร็จ"
            : result.status === "replaced"
              ? "แทนที่เอกสารเดิมสำเร็จ"
              : result.status === "kept"
                ? "ไม่บันทึก (Keep)"
                : "ยกเลิก (Cancel)",
      }),
      orgId,
    };
  } catch (err) {
    console.error("POST /api/clinic/knowledge:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
  });
}
