/**
 * E3.1 — สร้าง Pinecone index สำหรับ knowledge
 *
 * Usage:
 *   npx tsx scripts/setup-pinecone-index.ts
 *   npx tsx scripts/setup-pinecone-index.ts --dry-run
 *
 * Prerequisites:
 *   - PINECONE_API_KEY ใน .env.local
 *   - PINECONE_INDEX_NAME (optional, default: clinic-knowledge)
 *   - PINECONE_CLOUD, PINECONE_REGION (optional, default: aws, us-east-1)
 */

import path from "path";
import fs from "fs";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

const indexName = process.env.PINECONE_INDEX_NAME ?? "clinic-knowledge";
const cloud = process.env.PINECONE_CLOUD ?? "aws";
const region = process.env.PINECONE_REGION ?? "us-east-1";
const dimension = 1536;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    console.log("[E3.1] DRY RUN — ไม่สร้าง index จริง\n");
  }

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    console.error("ต้องตั้งค่า PINECONE_API_KEY ใน .env.local");
    process.exit(1);
  }

  const { Pinecone } = await import("@pinecone-database/pinecone");
  const pc = new Pinecone({ apiKey });

  const list = await pc.listIndexes();
  const exists = list.indexes?.some((i) => i.name === indexName);
  if (exists) {
    console.log(`[E3.1] Index "${indexName}" มีอยู่แล้ว`);
    const info = await pc.describeIndex(indexName);
    console.log("  - host:", info.host);
    console.log("  - dimension:", info.dimension);
    console.log("  - metric:", info.metric);
    return;
  }

  if (dryRun) {
    console.log(`[E3.1] จะสร้าง index: ${indexName}`);
    console.log(`  - dimension: ${dimension}`);
    console.log(`  - metric: cosine`);
    console.log(`  - cloud: ${cloud}, region: ${region}`);
    console.log(`  - namespace: knowledge (ใช้ตอน upsert/query)`);
    return;
  }

  console.log(`[E3.1] กำลังสร้าง index: ${indexName}...`);
  await pc.createIndex({
    name: indexName,
    dimension,
    metric: "cosine",
    spec: {
      serverless: {
        cloud,
        region,
      },
    },
    waitUntilReady: true,
  });
  console.log(`[E3.1] สร้าง index สำเร็จ`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
