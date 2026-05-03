import type { JobsOptions } from "bullmq";

export function buildRetryJobOptions(
  jobId?: string,
  opts?: {
    attempts?: number;
    backoffDelayMs?: number;
    delayMs?: number;
  }
): JobsOptions {
  const attempts = Math.max(1, opts?.attempts ?? 4);
  const backoffDelayMs = Math.max(1000, opts?.backoffDelayMs ?? 60_000);
  return {
    attempts,
    backoff: { type: "exponential", delay: backoffDelayMs },
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
    ...(typeof opts?.delayMs === "number" ? { delay: Math.max(0, opts.delayMs) } : {}),
    ...(jobId ? { jobId } : {}),
  };
}

