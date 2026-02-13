/**
 * Admin Circuit Breaker — Provider isolation control
 * GET: Status of all providers
 * POST: Reset circuit for provider (body: { provider: "pinecone" | "openai" })
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import {
  isProviderOpen,
  resetProviderCircuit,
  type ProviderId,
} from "@/lib/provider-circuit-breaker";

export const dynamic = "force-dynamic";

const PROVIDERS: ProviderId[] = ["pinecone", "openai", "firestore", "vector_search"];

export async function GET() {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const status = Object.fromEntries(
    PROVIDERS.map((p) => [p, { open: isProviderOpen(p) }])
  );
  return NextResponse.json({ providers: status });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  try {
    const body = await request.json();
    const provider = body?.provider as ProviderId | undefined;
    if (!provider || !PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Use: pinecone, openai, firestore, vector_search" },
        { status: 400 }
      );
    }
    await resetProviderCircuit(provider);
    return NextResponse.json({ ok: true, provider, message: "Circuit reset" });
  } catch (err) {
    console.error("POST /api/admin/circuit-breaker:", err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === "development" ? String(err) : "Server error" },
      { status: 500 }
    );
  }
}
