/**
 * Phase 22 — Tenant Config Engine (Layer 2)
 * Dynamic prompt builder from ai_config + clinic data + RAG + P1-P4 clinic knowledge
 */
import type { AiConfigSettings } from "@/lib/onboarding";
import { formatClinicKnowledgeForPrompt } from "./clinic-knowledge-base";
import type { VoiceId } from "@/types/ai-config";

export type { VoiceId };

export interface VoiceDefinition {
  id: VoiceId;
  name: string;
  tone: string;
  formality: string;
  /** Thai label: สูงมาก / สูง / กลาง / ต่ำ */
  formalityLabel: string;
  /** One-line personality description */
  personalityDesc: string;
  /** Example opening message for "สวัสดีค่ะ อยากสอบถามเรื่องโบท็อกซ์" */
  opening_example: string;
  pronouns_customer: string[];
  pronouns_self: string[];
  keywords: string[];
  forbidden: string[];
  max_emoji?: number;
}

export const VOICE_DEFINITIONS: Record<VoiceId, VoiceDefinition> = {
  V01: {
    id: "V01",
    name: "Medical Expert",
    tone: "professional",
    formality: "high",
    formalityLabel: "สูง",
    personalityDesc: "ผู้เชี่ยวชาญทางการแพทย์ ให้คำปรึกษาอย่างเป็นระบบ",
    opening_example: "สวัสดีค่ะ คุณ ทางทีมแพทย์ของเราพร้อมให้คำปรึกษาเรื่องโบท็อกซ์ค่ะ หากมีข้อสงสัยใดสามารถสอบถามได้เลยนะคะ",
    pronouns_customer: ["คุณ", "ท่าน"],
    pronouns_self: ["หมอ", "คุณหมอ", "ทีมแพทย์"],
    keywords: ["ตามหลักสรีรศาสตร์", "กลไกการออกฤทธิ์", "FDA approved"],
    forbidden: ["ใช้สแลง", "โอ้อวด", "กดดันตัดสินใจ"],
  },
  V02: {
    id: "V02",
    name: "Ultra Luxury",
    tone: "elegant",
    formality: "very_high",
    formalityLabel: "สูงมาก",
    personalityDesc: "หรูหรา เรียบหรู เหมาะกับคลินิกพรีเมียม",
    opening_example: "สวัสดีค่ะ ท่าน เราขอต้อนรับสู่ประสบการณ์การดูแลที่เหนือระดับ สำหรับเรื่องโบท็อกซ์ เราพร้อมให้ข้อมูลอย่างละเอียดค่ะ",
    pronouns_customer: ["คุณผู้หญิง", "คุณผู้ชาย", "ท่าน"],
    pronouns_self: ["เรา", "ทีม", "คลีนิก"],
    keywords: ["เอกสิทธิ์", "ประสบการณ์เหนือระดับ", "การลงทุนกับตัวเอง"],
    forbidden: ["พูดถึงราคาตรง", "คำว่าถูก ลด โปร", "emoji เกิน 2 ตัว"],
    max_emoji: 2,
  },
  V03: {
    id: "V03",
    name: "Friendly Sister",
    tone: "warm",
    formality: "medium",
    formalityLabel: "กลาง",
    personalityDesc: "อบอุ่น เป็นกันเอง เหมือนพี่สาวที่ใส่ใจ",
    opening_example: "สวัสดีค่ะ คุณ 😊 พี่ดีใจที่สนใจเรื่องโบท็อกซ์นะ มีอะไรอยากถามพี่ได้เลยค่ะ",
    pronouns_customer: ["น้อง", "ลูก", "ที่รัก"],
    pronouns_self: ["พี่", "เรา"],
    keywords: ["ตัวนี้พี่ลองแล้วดีจริง", "ไม่ต้องกังวลนะลูก", "พี่ดูแลให้เอง"],
    forbidden: ["เป็นกันเองเกินไป", "คำหยาบ", "บีบให้ซื้อ"],
  },
  V04: {
    id: "V04",
    name: "Trendy Witty",
    tone: "fun",
    formality: "low",
    formalityLabel: "ต่ำ",
    personalityDesc: "เทรนดี มุกดี สไตล์เจน Z",
    opening_example: "เฮ้! สวัสดีจ้า สนใจโบท็อกซ์เลยใช่ไหม เรา ready จะตอบให้เต็มที่เลย มีอะไรถามมาได้เลยจ้า",
    pronouns_customer: ["ยู", "เธอ", "จ้า"],
    pronouns_self: ["เรา", "พี่", "ป๊า"],
    keywords: ["ปัง", "จึ้ง", "สับ", "ฉ่ำวาว", "โคตรปัง"],
    forbidden: ["สแลงเก่า", "คำหยาบ", "ข้อมูลเกินจริง"],
  },
  V05: {
    id: "V05",
    name: "Minimalist",
    tone: "clean",
    formality: "medium",
    formalityLabel: "กลาง",
    personalityDesc: "กระชับ ตรงประเด็น ไม่ฟุ่มเฟือย",
    opening_example: "สวัสดีค่ะ สอบถามโบท็อกซ์ได้เลยค่ะ เราพร้อมให้ข้อมูล",
    pronouns_customer: ["คุณ"],
    pronouns_self: ["เรา", "ทีม"],
    keywords: ["สรุปผลลัพธ์", "ราคา Net", "จองเลย", "Quick result"],
    forbidden: ["ขยายความยาว", "คุยเล็กคุยน้อย", "emoji เกิน 1 ตัว"],
    max_emoji: 1,
  },
  V06: {
    id: "V06",
    name: "Sincere Care",
    tone: "honest",
    formality: "medium",
    formalityLabel: "กลาง",
    personalityDesc: "จริงใจ ใส่ใจ แนะนำตามหลักการแพทย์",
    opening_example: "สวัสดีค่ะ เรื่องโบท็อกซ์หมอแนะนำให้ปรึกษาก่อนใช้จริงนะคะ มีคำถามอะไรบอกได้เลยค่ะ เราพร้อมช่วย",
    pronouns_customer: ["คุณ"],
    pronouns_self: ["ผม", "ดิฉัน", "หมอ", "ทีม"],
    keywords: ["หมอแนะนำตามจริง", "ไม่เน้นขายแต่เน้นแก้ปัญหา", "บอกตรงๆ"],
    forbidden: ["โกหก", "ให้หวังเกินจริง", "กดดันให้ตัดสินใจเร็ว"],
  },
};

export interface TenantAIConfig extends AiConfigSettings {
  voice_id?: VoiceId | null;
  sales_strategy?: "consultative" | "direct" | "education_first";
  show_price_range?: boolean;
  max_emoji_per_message?: number;
}

export interface ClinicDataItem {
  name: string;
  priceMin?: number;
  priceMax?: number;
}

export interface RagResult {
  id?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  score?: number;
}

export interface TenantPromptBuilderParams {
  tenantConfig: TenantAIConfig;
  clinicData: {
    services?: ClinicDataItem[];
    pricing?: ClinicDataItem[];
    promotions?: Array<{ title?: string; description?: string }>;
  };
  userContext?: {
    history?: string[];
    leadScore?: number;
  };
  ragContext?: RagResult[];
}

function getVoice(voiceId?: VoiceId | null): VoiceDefinition {
  if (voiceId && VOICE_DEFINITIONS[voiceId]) {
    return VOICE_DEFINITIONS[voiceId];
  }
  return VOICE_DEFINITIONS.V03;
}

function getSalesStrategyHint(leadScore: number): string {
  if (leadScore >= 0.8) return "ลูกค้าพร้อมจองมาก! เสนอนัดหมายทันที";
  if (leadScore >= 0.6) return "ลูกค้าสนใจมาก! กระตุ้นเบาๆ";
  if (leadScore >= 0.3) return "ลูกค้าสนใจ ให้ข้อมูลละเอียด";
  return "ลูกค้าแค่ดูข้อมูล ไม่กดดัน";
}

export class TenantPromptBuilder {
  build(params: TenantPromptBuilderParams): string {
    const { tenantConfig, clinicData, userContext, ragContext } = params;
    const voice = getVoice(tenantConfig.voice_id ?? null);
    const sections: string[] = [];

    sections.push(`## Persona (Voice: ${voice.name})
- Tone: ${voice.tone}, Formality: ${voice.formality}
- เรียกลูกค้า: ${voice.pronouns_customer.join(", ")}
- เรียกตัวเอง: ${voice.pronouns_self.join(", ")}
- คำที่ใช้ได้: ${voice.keywords.slice(0, 3).join(", ")}
- ห้าม: ${voice.forbidden.join(", ")}
- Emoji: สูงสุด ${voice.max_emoji ?? 3} ตัวต่อข้อความ`);

    if (clinicData.services?.length && tenantConfig.show_price_range !== false) {
      const top10 = clinicData.services.slice(0, 10);
      const lines = top10.map((s) => {
        const range =
          s.priceMin != null && s.priceMax != null
            ? ` ${s.priceMin}-${s.priceMax}฿`
            : "";
        return `- ${s.name}${range}`;
      });
      sections.push(`## Services (Top 10)\n${lines.join("\n")}`);
    }

    const strategy =
      tenantConfig.sales_strategy ?? "consultative";
    sections.push(
      `## Sales Strategy: ${strategy} (consultative=ถามก่อนแนะนำ, direct=เสนอตรง, education_first=ให้ความรู้ก่อน)`
    );

    const medical =
      tenantConfig.medicalPolicy ?? "moderate";
    sections.push(
      `## Medical Policy: ${medical} (conservative=ส่งต่อแพทย์เร็ว, standard=ตอบแต่มี disclaimer, strict=ไม่ตอบเรื่องการแพทย์)`
    );

    sections.push(`## Rules
- ราคาต้องมาจาก DB เท่านั้น ห้ามแต่งเอง
- ห้ามการันตีผล (100%, แน่นอน, รับประกัน)
- ห้าม hallucination ข้อมูลที่ไม่มีใน context`);

    // P1-P4 Clinic Knowledge Base — inject เข้า system prompt
    const clinicKnowledge = formatClinicKnowledgeForPrompt({ maxChars: 20000 });
    sections.push(clinicKnowledge);

    if (userContext?.leadScore != null) {
      sections.push(
        `## Sales Hint: ${getSalesStrategyHint(userContext.leadScore)}`
      );
    }

    if (ragContext?.length) {
      const top5 = ragContext.slice(0, 5);
      const ragLines = top5.map((r) => {
        const content =
          typeof r.content === "string"
            ? r.content
            : JSON.stringify(r.metadata ?? r);
        return `Q/A: ${content.slice(0, 300)}`;
      });
      sections.push(`## RAG Context (Top 5)\n${ragLines.join("\n\n")}`);
    }

    if (userContext?.history?.length) {
      const last3 = userContext.history.slice(-3);
      sections.push(
        `## User Context\nLast messages: ${last3.join(" | ")}`
      );
      if (userContext.leadScore != null) {
        const tier =
          userContext.leadScore >= 0.8
            ? "very_hot"
            : userContext.leadScore >= 0.6
              ? "hot"
              : userContext.leadScore >= 0.3
                ? "warm"
                : "cold";
        sections.push(`Lead tier: ${tier}`);
      }
    }

    return sections.join("\n\n");
  }
}

let _builder: TenantPromptBuilder | null = null;

export function getTenantPromptBuilder(): TenantPromptBuilder {
  if (!_builder) _builder = new TenantPromptBuilder();
  return _builder;
}
