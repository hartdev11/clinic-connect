import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getRedisClient, isRedisConfigured } from "@/lib/redis-client";

export const dynamic = "force-dynamic";

type DependencyStatus = {
  name: "firestore" | "redis";
  ok: boolean;
  message?: string;
};

async function checkFirestore(): Promise<DependencyStatus> {
  try {
    await db.collection("organizations").limit(1).get();
    return { name: "firestore", ok: true };
  } catch {
    return { name: "firestore", ok: false, message: "unreachable" };
  }
}

async function checkRedis(): Promise<DependencyStatus> {
  if (!isRedisConfigured()) {
    return { name: "redis", ok: true, message: "not-configured" };
  }
  try {
    const client = await getRedisClient();
    if (!client) return { name: "redis", ok: false, message: "client-unavailable" };
    await client.ping();
    return { name: "redis", ok: true };
  } catch {
    return { name: "redis", ok: false, message: "unreachable" };
  }
}

export async function GET() {
  const [firestore, redis] = await Promise.all([checkFirestore(), checkRedis()]);
  const dependencies = [firestore, redis];
  const ready = dependencies.every((x) => x.ok);
  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      kind: "readiness",
      dependencies,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 }
  );
}

