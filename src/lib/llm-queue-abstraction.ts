/**
 * LLM Queue Abstraction — รองรับ async queue ในอนาคต
 * ตอนนี้เรียก LLM โดยตรง; ในอนาคตสลับเป็น queue worker ได้
 */
import type { ChatOrchestratorInput, ChatOrchestratorOutput } from "@/lib/ai/orchestrator";

export interface LLMTask {
  input: ChatOrchestratorInput;
  requestId?: string;
  correlationId?: string;
}

export interface LLMQueueAdapter {
  enqueue(task: LLMTask): Promise<ChatOrchestratorOutput>;
}

/**
 * Direct execution — ใช้ request thread โดยตรง
 * Production scale: สร้าง Redis/Bull adapter ที่เรียก chatOrchestrate ใน worker
 */
export function createDirectLLMAdapter(): LLMQueueAdapter {
  return {
    async enqueue(task: LLMTask): Promise<ChatOrchestratorOutput> {
      const { chatOrchestrate } = await import("@/lib/ai/orchestrator");
      return chatOrchestrate(task.input);
    },
  };
}
