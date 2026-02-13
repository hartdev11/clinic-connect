/**
 * Instrumentation — Next.js Runtime Hooks
 * Enterprise: Sentry error tracking (optional — ต้องตั้ง SENTRY_DSN)
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (!process.env.SENTRY_DSN?.trim()) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
