import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { verifyLineSignature } from "@/lib/line-webhook";
import { getRequestId } from "@/lib/request-context";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const correlationId = getRequestId(request) ?? randomUUID();
  const signature = request.headers.get("x-line-signature") ?? "";
  const lineSecret = process.env.LINE_CHANNEL_SECRET?.trim() ?? "";

  let rawBodyBytes: Buffer;
  try {
    rawBodyBytes = Buffer.from(await request.arrayBuffer());
  } catch (err) {
    console.error("[LINE Global Webhook] body read failed", { correlationId, err });
    return new NextResponse("OK", { status: 200 });
  }

  try {
    if (lineSecret) {
      const validSig = verifyLineSignature(rawBodyBytes, signature, lineSecret);
      if (!validSig) {
        console.warn("[LINE Global Webhook] invalid signature", { correlationId });
        return new NextResponse("OK", { status: 200 });
      }
    } else {
      console.warn("[LINE Global Webhook] LINE_CHANNEL_SECRET not configured", { correlationId });
    }

    // Legacy global route: signature validation only.
  } catch (err) {
    console.error("[LINE Global Webhook] unexpected error", { correlationId, err });
  }

  return new NextResponse("OK", { status: 200 });
}
