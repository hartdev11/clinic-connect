/**
 * Enterprise observability — latency, errors, cache, Firestore.
 * All modules are fail-safe (never throw).
 */
export { startTimer, endTimer, getLatencySummary, getLatencySamplesInWindow } from "./latency";
export type { LatencyContext } from "./latency";
export { recordApiError } from "./errors";
export type { ApiErrorContext } from "./errors";
export { recordCacheHit, recordCacheMiss, getCacheTotals, getCacheHitRate } from "./cache-metrics";
export { trackFirestoreQuery } from "./firestore";
export type { FirestoreQueryContext } from "./firestore";
export { runWithObservability } from "./run-with-observability";
