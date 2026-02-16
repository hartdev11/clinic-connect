/**
 * Global API error rate tracking. Fail-safe: never throws.
 */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_SAMPLES = 2000;

export interface ApiErrorContext {
  route: string;
  orgId?: string | null;
  branchId?: string | null;
  errorType: string;
  statusCode: number;
}

interface ErrorSample {
  timestamp: number;
  route: string;
  statusCode: number;
}

const errorSamples: ErrorSample[] = [];

function prune() {
  const cutoff = Date.now() - WINDOW_MS;
  while (errorSamples.length > 0 && errorSamples[0].timestamp < cutoff) errorSamples.shift();
  while (errorSamples.length > MAX_SAMPLES) errorSamples.shift();
}

/** Record an API error (5xx or unhandled). Never throws. */
export function recordApiError(ctx: ApiErrorContext): void {
  try {
    prune();
    errorSamples.push({
      timestamp: Date.now(),
      route: ctx.route,
      statusCode: ctx.statusCode,
    });
  } catch {
    // no-op
  }
}

/** Count errors in window (for summary). */
export function getErrorCountInWindow(): number {
  prune();
  const cutoff = Date.now() - WINDOW_MS;
  return errorSamples.filter((s) => s.timestamp >= cutoff).length;
}
