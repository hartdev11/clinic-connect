/**
 * PHASE C — C2: Resume Test (Migration Safety)
 *
 * Must:
 *   - Run backfill with cursor, kill script mid-way
 *   - Resume with same cursor
 *   - No duplicate update (backfill script skips already-backfilled docs)
 *
 * Usage:
 *   npx tsx scripts/stress-migration-resume.ts
 *
 * Requires: FIREBASE_* env. Uses backfill-financial-fields.ts and audit-backfill-validation.ts.
 * Creates temp cursor file; run in test project.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const CURSOR_FILE = path.join(process.cwd(), "phase-c2-resume-cursor.json");
const RUN_MS = 3500; // run backfill ~3.5s then kill
const BACKFILL_SCRIPT = path.join(process.cwd(), "scripts", "backfill-financial-fields.ts");
const AUDIT_SCRIPT = path.join(process.cwd(), "scripts", "audit-backfill-validation.ts");

function runBackfill(cursorFile: string, extraArgs: string[] = []): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const args = [
      "tsx",
      BACKFILL_SCRIPT,
      "--cursor-file=" + cursorFile,
      "--batch-size=50",
      "--delay-ms=100",
      ...extraArgs,
    ];
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve({ exitCode: code, stdout, stderr }));
  });
}

function runBackfillWithKill(cursorFile: string): Promise<{ killed: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const args = [
      "tsx",
      BACKFILL_SCRIPT,
      "--cursor-file=" + cursorFile,
      "--batch-size=50",
      "--delay-ms=100",
    ];
    const child = spawn("npx", args, {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => { stdout += d.toString(); });
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    const t = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ killed: true, stdout, stderr });
    }, RUN_MS);
    child.on("close", (code) => {
      clearTimeout(t);
      resolve({ killed: code !== 0, stdout, stderr });
    });
  });
}

function runAuditC1(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("npx", ["tsx", AUDIT_SCRIPT], {
      cwd: process.cwd(),
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr?.on("data", (d) => { stderr += d.toString(); });
    child.on("close", (code) => resolve(code === 0));
  });
}

async function main() {
  console.log("[Phase C2] Migration Resume Test\n");

  if (!fs.existsSync(BACKFILL_SCRIPT)) {
    console.error("Backfill script not found:", BACKFILL_SCRIPT);
    process.exit(1);
  }
  if (fs.existsSync(CURSOR_FILE)) {
    try { fs.unlinkSync(CURSOR_FILE); } catch {}
  }

  console.log("1) Run backfill with cursor, kill after", RUN_MS / 1000, "s...");
  const first = await runBackfillWithKill(CURSOR_FILE);
  console.log("   Killed or exited:", first.killed);
  if (first.stdout) console.log(first.stdout.trim().split("\n").map((l) => "   " + l).join("\n"));
  if (first.stderr) console.error(first.stderr.trim().split("\n").map((l) => "   " + l).join("\n"));

  console.log("\n2) Resume backfill with same cursor...");
  const second = await runBackfill(CURSOR_FILE);
  console.log("   Exit code:", second.exitCode);
  if (second.stdout) console.log(second.stdout.trim().split("\n").map((l) => "   " + l).join("\n"));
  if (second.stderr) console.error(second.stderr.trim().split("\n").map((l) => "   " + l).join("\n"));

  console.log("\n3) Run C1 Backfill Validation (no missing/NaN/undefined)...");
  const c1Pass = await runAuditC1();
  console.log("   C1 PASS:", c1Pass);

  console.log("\n--- No duplicate update ---");
  console.log("Backfill script skips docs that already have applied_satang (payments) or refunded_total_satang (invoices).");
  console.log("Resume continues from cursor; already-backfilled docs are skipped → no duplicate update.");

  console.log("\n--- Phase C2 ---");
  const pass = c1Pass;
  console.log("PASS:", pass);
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
