#!/usr/bin/env node
/**
 * Dev server launcher — sets NODE_EXTRA_CA_CERTS before Next.js starts.
 * Node reads this at process start; values in .env.local load too late for gRPC/Firestore TLS.
 */
import { spawn, execSync } from "child_process";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DEV_PORT = 3000;

function readEnvLocalCaPath() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) return null;
  const match = fs.readFileSync(envPath, "utf8").match(/^NODE_EXTRA_CA_CERTS=(.+)$/m);
  if (!match) return null;
  const raw = match[1].trim().replace(/^["']|["']$/g, "");
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.join(root, raw);
}

function resolveCaCertsPath() {
  const fromEnv = process.env.NODE_EXTRA_CA_CERTS?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(root, fromEnv);
  }
  const fromDotenv = readEnvLocalCaPath();
  if (fromDotenv && fs.existsSync(fromDotenv)) return fromDotenv;
  const defaultPem = path.join(root, "norton-root-ca.pem");
  if (fs.existsSync(defaultPem)) return defaultPem;
  return null;
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

function getPortOwnerPid(port) {
  if (process.platform !== "win32") return null;
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const line = out
      .split(/\r?\n/)
      .find((l) => l.includes("LISTENING") && l.includes(`:${port}`));
    if (!line) return null;
    const pid = Number.parseInt(line.trim().split(/\s+/).pop() ?? "", 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function printPortInUseHelp(port) {
  const pid = getPortOwnerPid(port);
  console.error(`\n[dev] Port ${port} is already in use${pid ? ` (PID ${pid})` : ""}.`);
  console.error("[dev] Stop the other dev server first (Ctrl+C in its terminal), then run:");
  if (pid) {
    console.error(`[dev]   Stop-Process -Id ${pid} -Force`);
  } else {
    console.error(`[dev]   netstat -ano | findstr :${port}`);
    console.error("[dev]   Stop-Process -Id <PID> -Force");
  }
  console.error("\n[dev] Running two instances causes EPERM on .next/trace and breaks Firestore login.\n");
}

const caPath = resolveCaCertsPath();
if (caPath) {
  process.env.NODE_EXTRA_CA_CERTS = caPath;
  console.log(`[dev] Using extra CA certs: ${caPath}`);
}

if (await isPortInUse(DEV_PORT)) {
  printPortInUseHelp(DEV_PORT);
  process.exit(1);
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const userArgs = process.argv.slice(2);
const hasPortFlag = userArgs.some(
  (arg, i) => arg === "-p" || arg === "--port" || arg.startsWith("--port=") || arg.startsWith("-p")
);
const args = hasPortFlag ? ["dev", ...userArgs] : ["dev", "-p", String(DEV_PORT), ...userArgs];

const child = spawn(process.execPath, [nextBin, ...args], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
