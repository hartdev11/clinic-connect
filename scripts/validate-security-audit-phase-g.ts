/**
 * PHASE G — Security & Audit validation
 *
 * ต้องตรวจ:
 *   1. refund มี user_id ใน audit
 *   2. payment มี created_by
 *   3. ไม่มี public endpoint เขียน financial
 *   4. API ตรวจ org_id ทุกครั้ง
 *   5. ไม่มี client-side calculated total
 *
 * Run: npx tsx scripts/validate-security-audit-phase-g.ts
 */

import fs from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "src");
const FINANCIAL_DATA = path.join(ROOT, "lib", "financial-data.ts");
const REFUNDS_ROUTE = path.join(ROOT, "app", "api", "clinic", "invoices", "[id]", "refunds", "route.ts");
const CONFIRM_PAYMENT_ROUTE = path.join(ROOT, "app", "api", "clinic", "invoices", "[id]", "confirm-payment", "route.ts");
const INVOICES_ID_ROUTE = path.join(ROOT, "app", "api", "clinic", "invoices", "[id]", "route.ts");

function readFile(p: string): string {
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8");
}

function main() {
  console.log("[Phase G] Security & Audit Validation\n");

  const financialData = readFile(FINANCIAL_DATA);
  const refundsRoute = readFile(REFUNDS_ROUTE);
  const confirmPaymentRoute = readFile(CONFIRM_PAYMENT_ROUTE);
  const invoicesIdRoute = readFile(INVOICES_ID_ROUTE);

  let pass = 0;
  const total = 5;

  // 1) Refund audit has user_id (createRefundWithAudit writes user_id: data.created_by)
  const c1 = financialData.includes("entity_type: \"refund\"") && financialData.includes("user_id: data.created_by");
  console.log("1) Refund มี user_id ใน audit:", c1 ? "PASS" : "FAIL");
  if (c1) pass++;

  // 2) Payment has created_by
  const c2 = financialData.includes("created_by: params.payment.created_by");
  console.log("2) Payment มี created_by:", c2 ? "PASS" : "FAIL");
  if (c2) pass++;

  // 3) No public financial write — confirm-payment and refunds require session + 401
  const confirmHasSession =
    confirmPaymentRoute.includes("getSessionFromCookies") &&
    confirmPaymentRoute.includes("!session") &&
    confirmPaymentRoute.includes("401");
  const refundsHasSession =
    refundsRoute.includes("getSessionFromCookies") &&
    refundsRoute.includes("!session") &&
    refundsRoute.includes("401");
  const c3 = confirmHasSession && refundsHasSession;
  console.log("3) ไม่มี public endpoint เขียน financial (session required):", c3 ? "PASS" : "FAIL");
  if (c3) pass++;

  // 4) API ตรวจ org_id
  const invoicesCheckOrg = invoicesIdRoute.includes("invoice.org_id") && invoicesIdRoute.includes("session.org_id");
  const confirmCheckOrg = confirmPaymentRoute.includes("invoice.org_id") && confirmPaymentRoute.includes("session.org_id");
  const refundsCheckOrg = refundsRoute.includes("invoice.org_id") && refundsRoute.includes("session.org_id");
  const c4 = invoicesCheckOrg && confirmCheckOrg && refundsCheckOrg;
  console.log("4) API ตรวจ org_id ทุกครั้ง:", c4 ? "PASS" : "FAIL");
  if (c4) pass++;

  // 5) No client-side calculated total — server computes applied_satang / validates totals
  const serverComputesApplied = financialData.includes("appliedSatang") && (financialData.includes("remaining") || financialData.includes("Math.min"));
  const refundValidatesTotal = financialData.includes("afterRefund") && financialData.includes("grandTotalSatang");
  const c5 = serverComputesApplied && refundValidatesTotal;
  console.log("5) ไม่มี client-side calculated total (server computes/validates):", c5 ? "PASS" : "FAIL");
  if (c5) pass++;

  const pct = Math.round((pass / total) * 100);
  console.log("\n--- Phase G ---");
  console.log(`Score: ${pass}/${total} (${pct}%)`);
  console.log("Stop after Phase G.");

  process.exit(pass === total ? 0 : 1);
}

main();
