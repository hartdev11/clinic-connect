#!/usr/bin/env node
/**
 * Generate placeholder PNG icons for PWA.
 * Run: node scripts/generate-pwa-icons.mjs
 * Requires: npm install sharp (one-time)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("Run: npm install sharp");
    process.exit(1);
  }

  const sizes = [192, 512];
  for (const size of sizes) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#F5E8E0"/>
            <stop offset="100%" stop-color="#D4957A"/>
          </linearGradient>
        </defs>
        <rect width="${size}" height="${size}" rx="${size / 6}" fill="url(#rg)"/>
        <text x="${size / 2}" y="${size * 0.6}" font-family="Georgia" font-size="${size / 4}" font-weight="500" fill="#6B3F52" text-anchor="middle">CC</text>
      </svg>
    `;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), png);
    console.log(`Created public/icon-${size}.png`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
