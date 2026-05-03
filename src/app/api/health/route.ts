import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  let backend: "ok" | "unreachable" = "unreachable";

  try {
    await db.collection("organizations").limit(1).get();
    backend = "ok";
  } catch {
    backend = "unreachable";
  }

  const status: "ok" | "degraded" = backend === "ok" ? "ok" : "degraded";
  return NextResponse.json(
    { status, backend, timestamp },
    { status: status === "ok" ? 200 : 503 }
  );
}
