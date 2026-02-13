/**
 * Session Storage — เก็บ ConversationState ต่อเนื่องระหว่าง request
 * ตอนนี้ใช้ in-memory (ต่อมาสามารถเปลี่ยนเป็น Redis/DB ได้)
 */
import type { ConversationState } from "./conversation-state";

// In-memory storage (ต่อมาสามารถเปลี่ยนเป็น Redis/DB)
const sessionStore = new Map<string, ConversationState>();

// TTL: เก็บ state ไว้ 30 นาที (1,800,000 ms)
const SESSION_TTL = 30 * 60 * 1000;

/**
 * ดึง state จาก session
 */
export function getSessionState(userId: string): ConversationState | null {
  const state = sessionStore.get(userId);
  if (!state) return null;

  // เช็ค TTL
  const now = Date.now();
  if (now - state.lastUpdated > SESSION_TTL) {
    sessionStore.delete(userId);
    return null;
  }

  return state;
}

/**
 * บันทึก state ลง session
 */
export function saveSessionState(userId: string, state: ConversationState): void {
  sessionStore.set(userId, {
    ...state,
    lastUpdated: Date.now(),
  });
}

/**
 * ลบ session (เมื่อจบการสนทนาหรือ reset)
 */
export function clearSession(userId: string): void {
  sessionStore.delete(userId);
}

/**
 * Cleanup sessions ที่หมดอายุ (เรียกเป็น periodic job)
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [userId, state] of sessionStore.entries()) {
    if (now - state.lastUpdated > SESSION_TTL) {
      sessionStore.delete(userId);
    }
  }
}

/**
 * ดึงจำนวน sessions ที่ active
 */
export function getActiveSessionCount(): number {
  return sessionStore.size;
}
