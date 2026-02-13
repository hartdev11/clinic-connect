/**
 * Rate Limiting — Re-export from distributed module (Firestore, multi-instance safe)
 * ห้ามใช้ in-memory
 */
export {
  checkDistributedRateLimit as checkRateLimit,
  IP_LIMIT,
  ORG_CHAT_LIMIT,
  RateLimitExceededError,
  getClientIp,
} from "@/lib/distributed-rate-limit";
