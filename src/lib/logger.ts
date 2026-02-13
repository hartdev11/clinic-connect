/**
 * Structured Logging — JSON format สำหรับ Production
 * ห้ามใช้ console.log ตรง ๆ ใน routes
 */
import { randomUUID } from "crypto";

export type LogLevel = "info" | "warn" | "error";

export interface LogPayload {
  requestId?: string;
  correlationId?: string;
  timestamp: string;
  level: LogLevel;
  route?: string;
  org_id?: string;
  user_id?: string;
  latency_ms?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

export interface RequestLoggerOpts {
  requestId?: string;
  correlationId?: string;
  route?: string;
  org_id?: string;
  user_id?: string;
}

function formatPayload(p: LogPayload): string {
  return JSON.stringify(p);
}

function emit(level: LogLevel, payload: Partial<LogPayload> & { message?: string }) {
  const p: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  };
  const out = formatPayload(p);
  if (level === "error") {
    process.stderr.write(out + "\n");
  } else {
    process.stdout.write(out + "\n");
  }
}

export function createRequestLogger(opts: RequestLoggerOpts) {
  const requestId = opts.requestId ?? randomUUID();
  const correlationId = opts.correlationId ?? requestId;
  const base = { ...opts, requestId, correlationId };
  return {
    requestId,
    correlationId,
    info: (msg: string, extra?: Record<string, unknown>) =>
      emit("info", { ...base, message: msg, ...extra }),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      emit("warn", { ...base, message: msg, ...extra }),
    error: (msg: string, err?: Error | unknown, extra?: Record<string, unknown>) =>
      emit("error", {
        ...base,
        message: msg,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        ...extra,
      }),
    withLatency: (latencyMs: number, statusCode?: number) => ({
      info: (msg: string, extra?: Record<string, unknown>) =>
        emit("info", { ...base, latency_ms: latencyMs, statusCode, message: msg, ...extra }),
      warn: (msg: string, extra?: Record<string, unknown>) =>
        emit("warn", { ...base, latency_ms: latencyMs, statusCode, message: msg, ...extra }),
      error: (msg: string, err?: Error | unknown, extra?: Record<string, unknown>) =>
        emit("error", {
          ...base,
          latency_ms: latencyMs,
          statusCode,
          message: msg,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          ...extra,
        }),
    }),
  };
}

export const log = {
  info: (msg: string, extra?: Record<string, unknown>) => emit("info", { message: msg, ...extra }),
  warn: (msg: string, extra?: Record<string, unknown>) => emit("warn", { message: msg, ...extra }),
  error: (msg: string, err?: Error | unknown, extra?: Record<string, unknown>) =>
    emit("error", {
      message: msg,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ...extra,
    }),
};
