/**
 * PHASE 6 — Redis-backed circuit breaker (provider:openai:state)
 * Resiliency: check before LLM call, record success/failure, retry with backoff in worker.
 */
import { getRedisClient } from "@/lib/redis-client";
import { log } from "@/lib/logger";

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  successThreshold: number;
  openDurationMs: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 3,
  openDurationMs: 60_000,
};

export const OPENAI_CIRCUIT_KEY = "provider:openai:state";

interface StoredState {
  state: CircuitState;
  failures: number;
  successes: number;
  openedAt: number;
}

const DEFAULT_STATE: StoredState = {
  state: "closed",
  failures: 0,
  successes: 0,
  openedAt: 0,
};

function parseState(raw: string | null): StoredState {
  if (!raw) return { ...DEFAULT_STATE };
  try {
    const o = JSON.parse(raw) as Partial<StoredState>;
    return {
      state: o.state === "open" || o.state === "half_open" ? o.state : "closed",
      failures: Number(o.failures) || 0,
      successes: Number(o.successes) || 0,
      openedAt: Number(o.openedAt) || 0,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/**
 * Check if circuit is open (block calls). Uses Redis key provider:openai:state.
 * If open and cooldown passed, transitions to half_open.
 */
export async function isCircuitOpen(
  key: string = OPENAI_CIRCUIT_KEY,
  options: CircuitBreakerOptions = DEFAULT_OPTIONS
): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  const raw = await client.get(key);
  const s = parseState(raw);
  const now = Date.now();

  if (s.state === "closed") return false;
  if (s.state === "half_open") return false;

  if (s.state === "open") {
    if (now - s.openedAt < options.openDurationMs) return true;
    const next: StoredState = { ...s, state: "half_open", failures: 0, successes: 0 };
    await client.set(key, JSON.stringify(next)).catch(() => {});
    return false;
  }
  return false;
}

/**
 * Record success — may close circuit (half_open → closed after successThreshold).
 */
export async function recordCircuitSuccess(
  key: string = OPENAI_CIRCUIT_KEY,
  options: CircuitBreakerOptions = DEFAULT_OPTIONS
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const raw = await client.get(key);
  const s = parseState(raw);

  if (s.state === "closed") {
    const next: StoredState = { ...s, failures: 0 };
    await client.set(key, JSON.stringify(next)).catch(() => {});
    return;
  }
  if (s.state === "half_open") {
    const successes = s.successes + 1;
    if (successes >= options.successThreshold) {
      const next: StoredState = { ...DEFAULT_STATE };
      await client.set(key, JSON.stringify(next)).catch(() => {});
      log.warn("Circuit breaker closed", { key });
    } else {
      const next: StoredState = { ...s, successes };
      await client.set(key, JSON.stringify(next)).catch(() => {});
    }
    return;
  }
  if (s.state === "open") {
    // no change
  }
}

/**
 * Record failure — may open circuit (closed/half_open → open after failureThreshold).
 */
export async function recordCircuitFailure(
  key: string = OPENAI_CIRCUIT_KEY,
  options: CircuitBreakerOptions = DEFAULT_OPTIONS
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  const raw = await client.get(key);
  const s = parseState(raw);
  const now = Date.now();

  const failures = s.failures + 1;
  const next: StoredState = {
    ...s,
    failures,
    successes: 0,
    openedAt: s.state === "open" ? s.openedAt : now,
  };

  if (s.state === "half_open") {
    next.state = "open";
    next.openedAt = now;
    await client.set(key, JSON.stringify(next)).catch(() => {});
    log.warn("Circuit breaker open (half_open failed)", { key });
    return;
  }
  if (s.state === "closed" && failures >= options.failureThreshold) {
    next.state = "open";
    next.openedAt = now;
    await client.set(key, JSON.stringify(next)).catch(() => {});
    log.warn("Circuit breaker open (threshold)", { key, failures });
    return;
  }
  if (s.state === "closed") {
    await client.set(key, JSON.stringify(next)).catch(() => {});
  }
}

/**
 * Execute fn with circuit: check before call, record success/failure after.
 */
export async function executeWithCircuit<T>(
  key: string,
  fn: () => Promise<T>,
  options: CircuitBreakerOptions = DEFAULT_OPTIONS
): Promise<T> {
  if (await isCircuitOpen(key, options)) {
    throw new Error(`Circuit open for ${key} — temporary isolation`);
  }
  try {
    const result = await fn();
    await recordCircuitSuccess(key, options);
    return result;
  } catch (err) {
    await recordCircuitFailure(key, options);
    throw err;
  }
}

/**
 * Reset circuit to closed (admin / testing).
 */
export async function resetCircuit(key: string = OPENAI_CIRCUIT_KEY): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.set(key, JSON.stringify({ ...DEFAULT_STATE })).catch(() => {});
}

/** Legacy interface: createCircuitBreaker returns object that uses Redis key */
export interface CircuitBreakerLike {
  state: CircuitState;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  recordSuccess(): Promise<void>;
  recordFailure(): Promise<void>;
}

export async function getCircuitState(key: string = OPENAI_CIRCUIT_KEY): Promise<CircuitState> {
  const client = await getRedisClient();
  if (!client) return "closed";
  const raw = await client.get(key);
  const s = parseState(raw);
  return s.state;
}

/**
 * Create a circuit breaker instance backed by Redis (key = provider:openai:state).
 */
export function createCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
): CircuitBreakerLike {
  const key = name === "openai" ? OPENAI_CIRCUIT_KEY : `provider:${name}:state`;
  const opts = { ...DEFAULT_OPTIONS, ...options };
  return {
    get state(): CircuitState {
      return "closed";
    },
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return executeWithCircuit(key, fn, opts);
    },
    async recordSuccess(): Promise<void> {
      return recordCircuitSuccess(key, opts);
    },
    async recordFailure(): Promise<void> {
      return recordCircuitFailure(key, opts);
    },
  };
}
