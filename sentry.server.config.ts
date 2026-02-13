/**
 * Sentry Server Config — Enterprise Error Tracking
 * ใช้เมื่อตั้ง SENTRY_DSN ใน .env
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    integrations: (defaults) =>
      defaults.filter((i) => !i.name?.toLowerCase().includes("prisma")),
  });
}
