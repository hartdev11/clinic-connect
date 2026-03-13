/**
 * Phase 11 — Admin service health
 * GET: Firestore, Redis, Pinecone, knowledge-health, env checks
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-guard";
import { db } from "@/lib/firebase-admin";
import { getRedisClient } from "@/lib/redis-client";

export const dynamic = "force-dynamic";

export interface ServiceStatus {
  name: string;
  ok: boolean;
  message?: string;
  lastChecked: string;
}

async function checkFirestore(): Promise<ServiceStatus> {
  const now = new Date().toISOString();
  try {
    await db.collection("organizations").limit(1).get();
    return { name: "Firestore", ok: true, lastChecked: now };
  } catch (err) {
    return {
      name: "Firestore",
      ok: false,
      message: (err as Error).message,
      lastChecked: now,
    };
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  const now = new Date().toISOString();
  try {
    const client = await getRedisClient();
    if (!client) {
      return { name: "Redis", ok: false, message: "REDIS_URL not configured", lastChecked: now };
    }
    await client.ping();
    return { name: "Redis", ok: true, lastChecked: now };
  } catch (err) {
    return {
      name: "Redis",
      ok: false,
      message: (err as Error).message,
      lastChecked: now,
    };
  }
}

async function checkPinecone(baseUrl: string, cookie: string): Promise<ServiceStatus> {
  const now = new Date().toISOString();
  try {
    const res = await fetch(`${baseUrl}/api/admin/knowledge-health`, {
      headers: cookie ? { Cookie: cookie } : {},
    });
    return {
      name: "Pinecone",
      ok: res.ok,
      message: res.ok ? undefined : `HTTP ${res.status}`,
      lastChecked: now,
    };
  } catch (err) {
    return {
      name: "Pinecone",
      ok: false,
      message: (err as Error).message,
      lastChecked: now,
    };
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdminSession();
  if (!guard.ok) return guard.response;

  const baseUrl =
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  const cookie = request.headers.get("cookie") ?? "";

  const [firestore, redis, pinecone] = await Promise.all([
    checkFirestore(),
    checkRedis(),
    checkPinecone(baseUrl, cookie),
  ]);

  const services = [firestore, redis, pinecone];

  return NextResponse.json({ services });
}
