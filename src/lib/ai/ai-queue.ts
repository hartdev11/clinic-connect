/**
 * AI Queue System — Enterprise
 * Concurrency limit สำหรับ LLM calls (ป้องกัน overload)
 * ตอนนี้ใช้ in-memory semaphore; อนาคตสลับเป็น Redis/Bull ได้
 */

const MAX_CONCURRENT = parseInt(process.env.CHAT_MAX_CONCURRENT ?? "10", 10) || 10;
const MAX_CONCURRENT_PER_ORG = parseInt(process.env.CHAT_MAX_CONCURRENT_PER_ORG ?? "5", 10) || 5;

let globalCount = 0;
const orgCount = new Map<string, number>();
const waitQueue: Array<{ orgId: string; resolve: (release: () => void) => void }> = [];

function tryWake() {
  if (waitQueue.length === 0) return;
  const head = waitQueue[0]!;
  const orgCur = orgCount.get(head.orgId) ?? 0;
  if (globalCount < MAX_CONCURRENT && orgCur < MAX_CONCURRENT_PER_ORG) {
    waitQueue.shift();
    globalCount++;
    orgCount.set(head.orgId, orgCur + 1);
    const release = () => {
      globalCount = Math.max(0, globalCount - 1);
      const cur = orgCount.get(head.orgId) ?? 1;
      orgCount.set(head.orgId, Math.max(0, cur - 1));
      tryWake();
    };
    head.resolve(release);
    tryWake();
  }
}

/** Acquire slot — รอจนกว่าจะมี slot ว่าง */
export async function acquireLLMSlot(orgId: string): Promise<() => void> {
  const orgCur = orgCount.get(orgId) ?? 0;
  if (globalCount < MAX_CONCURRENT && orgCur < MAX_CONCURRENT_PER_ORG) {
    globalCount++;
    orgCount.set(orgId, orgCur + 1);
    return () => {
      globalCount = Math.max(0, globalCount - 1);
      const c = orgCount.get(orgId) ?? 1;
      orgCount.set(orgId, Math.max(0, c - 1));
      tryWake();
    };
  }
  return new Promise<() => void>((resolve) => {
    waitQueue.push({ orgId, resolve });
  });
}
