/**
 * Wraps API handlers with latency + error recording. Fail-safe: never swallows errors.
 * Use in /api/clinic/* and /api/internal/* routes.
 */
import { NextResponse } from "next/server";
import { endTimer, startTimer, type LatencyContext } from "./latency";
import { recordApiError } from "./errors";

type ResponseLike = NextResponse | { response: NextResponse; orgId?: string | null; branchId?: string | null };

function isWrapped(res: ResponseLike): res is { response: NextResponse; orgId?: string | null; branchId?: string | null } {
  return typeof res === "object" && res !== null && "response" in res && (res as { response: unknown }).response instanceof NextResponse;
}

/**
 * Run handler with timing and error recording.
 * Handler may return NextResponse or { response, orgId?, branchId? }.
 */
export async function runWithObservability(
  route: string,
  request: Request,
  handler: () => Promise<ResponseLike>
): Promise<NextResponse> {
  const method = request.method ?? "GET";
  const start = startTimer();
  try {
    const result = await handler();
    const response = isWrapped(result) ? result.response : result;
    const status = response.status;
    const orgId = isWrapped(result) ? result.orgId : undefined;
    const branchId = isWrapped(result) ? result.branchId : undefined;
    if (status >= 500) {
      try {
        recordApiError({ route, orgId, branchId, errorType: "http_5xx", statusCode: status });
      } catch {
        // no-op
      }
    }
    endTimer({
      route,
      method,
      orgId,
      branchId,
      status,
      start,
    });
    return response;
  } catch (err) {
    try {
      recordApiError({
        route,
        errorType: err instanceof Error ? err.message : String(err),
        statusCode: 500,
      });
    } catch {
      // no-op
    }
    endTimer({ route, method, status: 500, start });
    throw err;
  }
}
