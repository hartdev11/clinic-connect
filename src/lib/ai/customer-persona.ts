/**
 * Customer Persona / AI Mask — Phase 6
 * Adapts tone based on customer segment
 */
export type PersonaType =
  | "friendly_direct"
  | "professional_consultative"
  | "luxury_experience";

export interface CustomerPersonaInput {
  age?: number | null;
  totalSpend?: number | null;
  firstVisit?: boolean;
  clinicStyle?: "luxury" | "budget" | "friendly" | null;
  /** Fallback when data insufficient */
}

const TONE_INSTRUCTIONS: Record<PersonaType, string> = {
  friendly_direct:
    "เป็นกันเอง ใช้ emoji ได้มาก close เร็ว สั้น กระชับ ไม่ต้องอธิบายยาว",
  professional_consultative:
    "สุภาพ ให้ข้อมูลละเอียด ไม่เร่ง บรรยายให้เข้าใจชัด",
  luxury_experience:
    "หรูหรา formal เน้นคุณภาพ ประสบการณ์ premium",
};

/**
 * Determine persona from customer/profile data.
 * Use defaults when data is missing.
 */
export function getCustomerPersona(input: CustomerPersonaInput): PersonaType {
  const age = input.age ?? 40; // default: professional
  const totalSpend = input.totalSpend ?? 0;
  const firstVisit = input.firstVisit ?? false;
  const clinicStyle = input.clinicStyle ?? "friendly";

  // luxury_experience takes priority
  if (totalSpend > 30000 || clinicStyle === "luxury") {
    return "luxury_experience";
  }
  // professional for first visit or older
  if (age >= 35 || firstVisit) {
    return "professional_consultative";
  }
  // young + low spend
  if (age < 35 && totalSpend < 10000) {
    return "friendly_direct";
  }
  return "professional_consultative";
}

/**
 * Get tone instructions for system prompt injection.
 */
export function getPersonaToneInstructions(persona: PersonaType): string {
  return TONE_INSTRUCTIONS[persona];
}
