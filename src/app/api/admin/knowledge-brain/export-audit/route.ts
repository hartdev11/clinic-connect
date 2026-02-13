/**
 * Phase 3 #14 — Enterprise Audit Export
 * GET /api/admin/knowledge-brain/export-audit
 * Formats: json, csv, soc2
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const format = request.nextUrl.searchParams.get("format") || "json";
    const orgId = request.nextUrl.searchParams.get("org_id");
    const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || 1000, 5000);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const knowledgeActions = ["knowledge_create", "knowledge_update", "knowledge_approve", "knowledge_reject", "knowledge_rollback", "knowledge_reindex"];

    const auditSnap = await db
      .collection("audit_logs")
      .orderBy("timestamp", "desc")
      .limit(limit * 2)
      .get();

    type AuditEntry = { id: string; org_id?: string; action?: string; timestamp: string; [k: string]: unknown };
    const knowledgeChanges: AuditEntry[] = auditSnap.docs
      .filter((d) => knowledgeActions.includes(d.data().action) && (!orgId || d.data().org_id === orgId))
      .slice(0, limit)
      .map((d) => {
        const data = d.data();
        return { id: d.id, ...data, timestamp: toISO(data.timestamp) } as AuditEntry;
      });

    const aiSnap = await db
      .collection("ai_activity_logs")
      .orderBy("created_at", "desc")
      .limit(limit * 2)
      .get();

    const aiTraces = aiSnap.docs
      .filter((d) => !orgId || d.data().org_id === orgId)
      .slice(0, limit)
      .map((d) => {
      const data = d.data();
      return {
        org_id: data.org_id,
        correlation_id: data.correlation_id,
        knowledge_version_used: data.knowledge_version_used ?? data.knowledge_version,
        similarity_score: data.similarity_score ?? data.retrieval_confidence,
        retrieval_mode: data.retrieval_mode,
        confidence_level: data.confidence_level ?? data.response_confidence,
        prompt_version: data.prompt_version,
        model_version: data.model_version,
        retrieval_cost_estimate: data.retrieval_cost_estimate,
        generation_cost_estimate: data.generation_cost_estimate,
        performance_breach: data.performance_breach,
        created_at: toISO(data.created_at),
      };
    });

    const bulkSnap = await db.collection("global_bulk_update_notifications").orderBy("created_at", "desc").limit(100).get();
    const complianceEvents = bulkSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, created_at: toISO(data.created_at) };
    });

    // Phase 3 #14: drift_alerts — knowledge marked needs_review
    const driftSnap = await db
      .collection("clinic_knowledge")
      .where("status", "==", "needs_review")
      .limit(limit)
      .get();
    const driftAlerts = driftSnap.docs
      .filter((d) => !orgId || d.data().org_id === orgId)
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          org_id: data.org_id,
          base_service_id: data.base_service_id,
          status: data.status,
          updated_at: toISO(data.updated_at),
        };
      });

    const result = {
      knowledge_changes: knowledgeChanges,
      approval_logs: knowledgeChanges.filter((k) =>
        ["knowledge_approve", "knowledge_reject"].includes(k.action ?? "")
      ),
      compliance_events: complianceEvents,
      drift_alerts: driftAlerts,
      ai_response_trace_logs: aiTraces,
    };

    if (format === "csv") {
      const lines: string[] = [];
      lines.push("type,id,org_id,action,timestamp");
      for (const k of knowledgeChanges) {
        lines.push(`knowledge,${k.id},${k.org_id ?? ""},${k.action ?? ""},${k.timestamp ?? ""}`);
      }
      for (const a of aiTraces) {
        lines.push(`ai_trace,,${a.org_id ?? ""},,,${a.created_at ?? ""}`);
      }
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="knowledge-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const soc2Report = {
      report_type: "SOC2_READY",
      generated_at: new Date().toISOString(),
      scope: { org_id: orgId ?? "all" },
      summary: {
        knowledge_changes: knowledgeChanges.length,
        ai_traces: aiTraces.length,
        drift_alerts: driftAlerts.length,
      },
      data: result,
    };

    return NextResponse.json(soc2Report);
  } catch (err) {
    console.error("GET /api/admin/knowledge-brain/export-audit:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
