#!/usr/bin/env node
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const ROOT = join(process.cwd(), "src");
const CLINIC_PATHS = [
  join(ROOT, "app", "(clinic)"),
  join(ROOT, "components", "ui"),
  join(ROOT, "components", "layout"),
  join(ROOT, "components", "clinic"),
];
const EXCLUDE = ["ent-tokens.css", "globals.css", "tailwind.config"];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const BAD = [
  "bg-white", "text-white", "bg-black", "text-black",
  "bg-gray-", "text-gray-", "border-gray-",
  "bg-red-", "text-red-", "border-red-",
  "bg-amber-", "text-amber-", "border-amber-",
  "bg-green-", "text-green-", "border-green-",
  "bg-slate-", "text-slate-", "border-slate-",
  "text-surface-500", "text-surface-600", "text-surface-700", "text-surface-800", "text-surface-900",
  "bg-surface-50", "bg-surface-100", "border-surface-100", "border-surface-200",
  "text-primary-600", "bg-primary-50", "border-primary-",
];

function walk(dir, exts, out = []) {
  try {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name);
      if (name.isDirectory()) {
        if (name.name !== "node_modules") walk(full, exts, out);
      } else if (exts.some((e) => name.name.endsWith(e))) out.push(full);
    }
  } catch (_) {}
  return out;
}

function collectFiles() {
  const out = [];
  for (const dir of CLINIC_PATHS) {
    try {
      walk(dir, [".tsx", ".ts", ".jsx", ".js"], out);
    } catch (_) {}
  }
  return out.filter((f) => !EXCLUDE.some((e) => f.includes(e)));
}

let failed = 0;
for (const file of collectFiles()) {
  const content = readFileSync(file, "utf8");
  const rel = file.replace(process.cwd(), "").replace(/\\/g, "/");
  const lines = content.split("\n");

  const hexMatches = [...content.matchAll(HEX)];
  if (hexMatches.length) {
    hexMatches.forEach((m) => {
      const idx = content.indexOf(m[0]);
      const lineNum = content.slice(0, idx).split("\n").length;
      console.log(`${rel}:${lineNum}: hex ${m[0]} — use var(--ent-*)`);
    });
    failed++;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const bad of BAD) {
      if (line.includes(bad)) {
        console.log(`${rel}:${i + 1}: ${bad} — use ent tokens`);
        failed++;
        break;
      }
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
