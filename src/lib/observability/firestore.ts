/**
 * Firestore query cost monitoring. Fail-safe: never throws.
 * Wrap calls at the data layer; do not change query logic.
 */
export interface FirestoreQueryContext {
  collection: string;
  operation: "get" | "aggregate" | "count";
  orgId?: string | null;
  durationMs: number;
  docCount?: number;
}

/** Track a Firestore read. Never throws. */
export function trackFirestoreQuery(ctx: FirestoreQueryContext): void {
  try {
    if (process.env.OBS_LOG_FIRESTORE === "true") {
      console.log(
        JSON.stringify({
          type: "firestore_query",
          collection: ctx.collection,
          operation: ctx.operation,
          org_id: ctx.orgId ?? undefined,
          duration_ms: ctx.durationMs,
          doc_count: ctx.docCount ?? undefined,
          timestamp: new Date().toISOString(),
        })
      );
    }
  } catch {
    // no-op
  }
}
