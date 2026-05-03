/**
 * Client Error Logging — รับ error จาก frontend error boundary
 */
import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
import { checkDistributedRateLimit, getClientIp } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rate = await checkDistributedRateLimit(`public:log-error:ip:${ip}`, 30, 60);
    if (!rate.allowed) {
      return NextResponse.json({ received: false, retryAfterMs: rate.retryAfterMs }, { status: 429 });
    }
    const body = await request.json();
    const { message, stack, route, userAgent } = body as {
      message?: string;
      stack?: string;
      route?: string;
      userAgent?: string;
    };

    log.error("Client error", new Error((message ?? "Unknown client error").slice(0, 500)), {
      route,
      userAgent: userAgent?.slice(0, 200),
      stack: stack?.slice(0, 2000),
    });

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }
}
