/**
 * Agent C — Business Knowledge Engine
 * E4.2–E4.5 — RAG Integration
 * หน้าที่: ดึงข้อมูลธุรกิจ (ราคา / โปร / เงื่อนไข)
 * - RAG ก่อน → Error → fallback static
 */
import type { KnowledgeResult } from "./types";
import type { IntentType, ServiceType, ServiceCategory, Area } from "./types";
import {
  searchKnowledgeWithPyramid,
  type KnowledgeSearchContext,
} from "@/lib/knowledge-vector";

const KNOWLEDGE_BASE: Record<string, KnowledgeResult> = {
  chin_filler: {
    service: "chin_filler",
    price: "เริ่มต้นประมาณ 9,000–15,000 บาท",
    promotion: "มีโปรตามช่วงเวลา",
    note: "ควรประเมินก่อนทำ",
  },
  rejuran: {
    service: "rejuran",
    price: "เริ่มต้นประมาณ 5,000–12,000 บาท (ขึ้นกับจุด)",
    promotion: "มีโปรอยู่ ลดถึงสิ้นเดือน",
    note: "ช่วยเติมความชุ่มชื้น กระตุ้นคอลลาเจน",
  },
  botox: {
    service: "botox",
    price: "เริ่มต้นประมาณ 3,000–8,000 บาท",
    promotion: "มีโปร",
    note: "ลดริ้วรอย คิ้ว",
  },
  filler: {
    service: "filler",
    price: "เริ่มต้นประมาณ 8,000–15,000 บาท",
    promotion: "มีโปรตามช่วงเวลา",
    note: "ขึ้นกับยี่ห้อและปริมาณที่ใช้",
  },
  laser: {
    service: "laser",
    price: "เริ่มต้นประมาณ 2,000–10,000 บาท",
    promotion: "มีโปร",
    note: "ขึ้นกับประเภท",
  },
  unknown: {
    service: "unknown",
    price: undefined,
    promotion: undefined,
    note: undefined,
  },
  default: {
    service: "คลินิกความงาม",
    price: undefined,
    promotion: undefined,
    note: undefined,
  },
};

function normalizeService(service?: ServiceType | string): string {
  if (!service || !String(service).trim()) return "default";
  const s = String(service).toLowerCase();
  if (s.includes("chin") || s === "chin_filler") return "chin_filler";
  if (s.includes("rejuran") || s.includes("รีจูรัน")) return "rejuran";
  if (s.includes("botox") || s.includes("โบท็อกซ์")) return "botox";
  if (s.includes("filler") || s.includes("ฟิลเลอร์")) return "filler";
  if (s.includes("laser") || s.includes("เลเซอร์")) return "laser";
  if (s.includes("surgery") || s.includes("จมูก") || s.includes("ศัลยกรรม"))
    return "surgery";
  return "unknown";
}

function getStaticKnowledge(
  service?: ServiceType | ServiceCategory | string,
  area?: Area
): KnowledgeResult | null {
  if (!service) return null;
  const key = normalizeService(service);
  const data = KNOWLEDGE_BASE[key];
  if (!data || key === "unknown" || key === "default") return null;
  if (service === "filler" && area === "lip") {
    return {
      ...data,
      price: "เริ่มต้นประมาณ 8,000–15,000 บาท",
      note: "ขึ้นกับยี่ห้อและปริมาณที่ใช้",
    };
  }
  return { ...data };
}

/** E4: สร้าง RAG context จาก search results */
function buildRagContext(
  results: { metadata?: Record<string, unknown> }[]
): string {
  const parts: string[] = [];
  for (const r of results) {
    const m = r.metadata;
    if (!m) continue;
    const content = m.content as string | undefined;
    const topic = m.topic as string | undefined;
    const keyPoints = m.key_points;
    let text = content || "";
    if (!text && topic) text = `หัวข้อ: ${topic}`;
    if (!text && keyPoints) {
      try {
        const arr = typeof keyPoints === "string" ? JSON.parse(keyPoints) : keyPoints;
        if (Array.isArray(arr)) text = arr.join(" ");
      } catch {
        text = String(keyPoints);
      }
    }
    if (text.trim()) parts.push(text.trim());
  }
  return parts.length > 0 ? parts.join("\n\n") : "";
}

export interface GetKnowledgeOptions {
  userMessage?: string;
  org_id?: string;
  branch_id?: string;
}

/**
 * E4.2–E4.5 — ดึง knowledge: RAG ก่อน, error → fallback static
 */
export async function getKnowledge(
  intent: IntentType,
  service?: ServiceType | ServiceCategory | string,
  area?: Area,
  options?: GetKnowledgeOptions
): Promise<KnowledgeResult | null> {
  const staticResult = getStaticKnowledge(service, area);

  // Build RAG query
  const queryParts: string[] = [];
  if (service) queryParts.push(String(service));
  if (area && area !== "unknown") queryParts.push(String(area));
  queryParts.push(intent);
  if (options?.userMessage?.trim()) queryParts.push(options.userMessage.trim());
  const query = queryParts.join(" ").trim();
  if (!query) return staticResult;

  // Pyramid context
  const level = options?.org_id && options?.branch_id ? "branch" : options?.org_id ? "org" : "global";
  const ctx: KnowledgeSearchContext = {
    level,
    org_id: options?.org_id,
    branch_id: options?.branch_id,
  };

  try {
    const results = await searchKnowledgeWithPyramid(query, ctx, {
      topK: 5,
      is_active: true,
    });
    const ragContext = buildRagContext(results);
    if (ragContext && staticResult) {
      return { ...staticResult, ragContext };
    }
    if (ragContext && !staticResult) {
      return {
        service: service ? String(service) : undefined,
        ragContext,
      };
    }
    return staticResult;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Agent C] RAG error, using static fallback:", (err as Error)?.message?.slice(0, 80));
    }
    return staticResult;
  }
}
