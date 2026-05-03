import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest, type SessionPayload } from "@/lib/auth-session";

export type PhaseService = "G" | "K" | "L" | "I" | "H" | "J" | "M" | "N";

const PHASE_URL_ENV: Record<PhaseService, string> = {
  G: "PHASE_G_URL",
  K: "PHASE_K_URL",
  L: "PHASE_L_URL",
  I: "PHASE_I_URL",
  H: "PHASE_H_URL",
  J: "PHASE_J_URL",
  M: "PHASE_M_URL",
  N: "PHASE_N_URL",
};

export type ProxyContext = {
  session: SessionPayload;
  tenantId: string;
  userId: string;
  requestId: string;
};

export type SessionResult =
  | { ok: true; context: ProxyContext }
  | { ok: false; response: NextResponse };

export async function requireProxySession(request: NextRequest): Promise<SessionResult> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      ),
    };
  }

  const tenantId = session.org_id;
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Unauthorized", code: "TENANT_REQUIRED" },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    context: {
      session,
      tenantId,
      userId: session.user_id ?? session.clinicId,
      requestId: randomUUID(),
    },
  };
}

function getPhaseBaseUrl(service: PhaseService): string | null {
  const key = PHASE_URL_ENV[service];
  return process.env[key]?.trim().replace(/\/+$/, "") ?? null;
}

function joinUrl(baseUrl: string, upstreamPath: string): string {
  const path = upstreamPath.startsWith("/") ? upstreamPath : `/${upstreamPath}`;
  return `${baseUrl}${path}`;
}

export type ProxyForwardOptions = {
  request: NextRequest;
  context: ProxyContext;
  service: PhaseService;
  upstreamPath: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  forwardQuery?: boolean;
  extraHeaders?: Record<string, string>;
};

export async function proxyPhaseRequest(options: ProxyForwardOptions): Promise<NextResponse> {
  const {
    request,
    context,
    service,
    upstreamPath,
    method = request.method as ProxyForwardOptions["method"],
    body,
    forwardQuery = false,
    extraHeaders = {},
  } = options;

  const baseUrl = getPhaseBaseUrl(service);
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: `Missing backend URL: ${PHASE_URL_ENV[service]}`,
        code: "PHASE_URL_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const target = new URL(joinUrl(baseUrl, upstreamPath));
  if (forwardQuery) {
    for (const [key, value] of request.nextUrl.searchParams.entries()) {
      target.searchParams.append(key, value);
    }
    // Enforce tenant binding from session context; never trust client tenant scope.
    target.searchParams.set("tenant_id", context.tenantId);
    target.searchParams.set("clinic_id", context.tenantId);
    if (!target.searchParams.has("branch_id") && context.session.branch_id) {
      target.searchParams.set("branch_id", context.session.branch_id);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const serviceSecret = process.env.PHASE_SERVICE_SECRET?.trim();

  try {
    const payload =
      body !== undefined
        ? body
        : method === "GET" || method === "DELETE"
          ? undefined
          : await request.json().catch(() => ({}));

    const response = await fetch(target.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": context.tenantId,
        "X-User-Id": context.userId,
        "X-Request-Id": context.requestId,
        ...(serviceSecret ? { "X-Service-Secret": serviceSecret } : {}),
        ...extraHeaders,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Upstream service request failed",
          code: "UPSTREAM_ERROR",
          status: response.status,
          service,
          details: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data ?? {});
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return NextResponse.json(
        { error: "Upstream request timeout", code: "UPSTREAM_TIMEOUT", service },
        { status: 504 }
      );
    }
    return NextResponse.json(
      {
        error: "Proxy request failed",
        code: "PROXY_ERROR",
        service,
        details: (error as Error)?.message ?? String(error),
      },
      { status: 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
