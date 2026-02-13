/**
 * Stub for @prisma/instrumentation — ใช้เมื่อโปรเจกต์ไม่ใช้ Prisma
 * Prevents Sentry from loading OpenTelemetry/Prisma and eliminates webpack warning.
 */
class PrismaInstrumentation {
  constructor() {}
  setupOnce() {}
}
module.exports = { PrismaInstrumentation };
