/**
 * Enterprise Provider Circuit Breaker
 * Automatic provider isolation, vector search disable, cascading failure prevention
 */
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { log } from "@/lib/logger";

export type ProviderId = "pinecone" | "openai" | "firestore" | "vector_search";

const COLLECTION = "provider_circuit_breaker";
const FAILURE_THRESHOLD = 5; // consecutive failures to open
const SUCCESS_THRESHOLD = 3; // consecutive successes to half-open
const COOLDOWN_MS = 60_000; // 1 min open before half-open
const WINDOW_MS = 60_000; // 1 min rolling window for error ratio
const ERROR_RATIO_THRESHOLD = 0.6; // 60% error rate
const MIN_CALLS_FOR_RATIO = 10;

interface ProviderState {
  state: "closed" | "open" | "half_open";
  failures: number;
  successes: number;
  lastFailureAt: number;
  openedAt: number;
}

const inMemory: Map<ProviderId, ProviderState> = new Map();

function getOrCreate(provider: ProviderId): ProviderState {
  let s = inMemory.get(provider);
  if (!s) {
    s = { state: "closed", failures: 0, successes: 0, lastFailureAt: 0, openedAt: 0 };
    inMemory.set(provider, s);
  }
  return s;
}

/** Check if provider circuit is open (block calls) */
export function isProviderOpen(provider: ProviderId): boolean {
  const s = getOrCreate(provider);
  if (s.state === "closed") return false;
  if (s.state === "open" && Date.now() - s.openedAt < COOLDOWN_MS) return true;
  if (s.state === "open") {
    s.state = "half_open";
    s.failures = 0;
    s.successes = 0;
  }
  return false;
}

/** Temporary disable vector search when Pinecone circuit is open */
export function isVectorSearchDisabled(): boolean {
  return isProviderOpen("pinecone") || isProviderOpen("vector_search");
}

/** Record provider failure — may open circuit */
export function recordProviderFailure(provider: ProviderId): void {
  const s = getOrCreate(provider);
  s.lastFailureAt = Date.now();
  s.failures++;
  s.successes = 0;

  if (s.state === "half_open") {
    s.state = "open";
    s.openedAt = Date.now();
    void logProviderCircuitOpen(provider, "half_open_failed");
    return;
  }

  if (s.failures >= FAILURE_THRESHOLD && s.state === "closed") {
    s.state = "open";
    s.openedAt = Date.now();
    void logProviderCircuitOpen(provider, "threshold_exceeded");
  }
}

/** Record provider success — may close circuit */
export function recordProviderSuccess(provider: ProviderId): void {
  const s = getOrCreate(provider);
  s.successes++;
  if (s.state === "half_open" && s.successes >= SUCCESS_THRESHOLD) {
    s.state = "closed";
    s.failures = 0;
    s.successes = 0;
    log.warn("Provider circuit closed", { provider });
  }
  if (s.state === "closed") {
    s.failures = 0; // reset on success
  }
}

async function logProviderCircuitOpen(provider: ProviderId, reason: string): Promise<void> {
  log.warn("Provider circuit breaker OPEN", { provider, reason, cooldown_minutes: COOLDOWN_MS / 60000 });
  try {
    await db.collection(COLLECTION).add({
      provider,
      reason,
      opened_at: FieldValue.serverTimestamp(),
      cooldown_ms: COOLDOWN_MS,
    });
  } catch {
    // non-blocking
  }
}

/** Cascading failure prevention: wrap provider call with circuit breaker */
export async function withCircuitBreaker<T>(
  provider: ProviderId,
  fn: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  if (isProviderOpen(provider)) {
    if (fallback) return fallback();
    throw new Error(`Provider ${provider} circuit open — temporary isolation`);
  }
  try {
    const result = await fn();
    recordProviderSuccess(provider);
    return result;
  } catch (err) {
    recordProviderFailure(provider);
    if (fallback) return fallback();
    throw err;
  }
}

/** Manual reset (admin only) */
export async function resetProviderCircuit(provider: ProviderId): Promise<void> {
  inMemory.set(provider, {
    state: "closed",
    failures: 0,
    successes: 0,
    lastFailureAt: 0,
    openedAt: 0,
  });
}
