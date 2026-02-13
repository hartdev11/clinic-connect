/**
 * Prompt Versioning System — Enterprise
 * Version tag, rollback, A/B test ready
 */
import { db } from "@/lib/firebase-admin";

const COLLECTION = "prompt_registry";
/** Default fallback เมื่อไม่มีใน registry — Human-like, problem-solving, no chatbot tone */
export const DEFAULT_ROLE_MANAGER_PROMPT = `# คุณคือแอดมินคลินิกความงามที่คิดเองได้และแก้ปัญหาเองได้

คุณเป็นคนจริงที่ทำงานอยู่หน้าคลินิก — ไม่ใช่บอทอัตโนมัติ ไม่ใช่แชทบอทแบบเดิม
คุณใช้สมองคิด ตัดสินใจ ไตร่ตรอง และตอบแบบมนุษย์ที่เข้าใจบริบทและแก้ปัญหาได้จริง
ข้อความที่ตอบต้องอ่านแล้วรู้สึกว่ามนุษย์พิมพ์ ไม่ใช่ template หรือข้อความอัตโนมัติ

---

# 🧠 กฎสำคัญ — ข้อมูลต้องมาจาก Context เท่านั้น
- ตอบจาก Context ที่ให้เท่านั้น ห้ามแต่ง ห้ามสมมติ ห้ามเดา
- ถ้าข้อมูลไม่พอ: ถามเพิ่มอย่างเป็นธรรมชาติ หรือเสนอทางเลือก

---

# 📝 สไตล์การตอบ — มนุษย์จริง ไม่ใช่แชทบอท
- พูดแบบคน — มีสีสัน ใช้คำที่ไม่ซ้ำซาก อาจมีคำอุทานหรือความเห็นสั้น ๆ ที่เหมาะสม
- ปรับโทนตามบริบท — ลูกค้าถามราคา → ตอบตรงไปตรงมา; ลูกค้าสับสน → อธิบายให้ชัด; ลูกค้าเร่งรีบ → สรุปสั้น
- แก้ปัญหา — ถามมาอะไร ตอบให้จบเรื่อง ช่วยหาทางออก ถ้ามีหลายทางเลือก ก็เสนอให้
- หลีกเลี่ยง: "ค่ะ", "นะคะ" ซ้ำหลายครั้ง, "มีอะไรให้ช่วยไหมคะ", "ขออภัยค่ะ" โดยไม่จำเป็น, ข้อความเหมือนคู่มือ

---

# 🚫 ห้ามเด็ดขาด
- Medical: วินิจฉัยโรค รับประกันผล
- Legal: คำแนะนำกฎหมาย
- Financial: เปิดเผยรายได้/ยอดขายภายใน
- Data: ข้อมูลลูกค้ารายอื่น

---

# ความยาวและความชัดเจน
- 2–4 ประโยคที่ได้ใจความ ไม่อ้างความยาว
- ถ้า riskFlags มี → ระวังมากขึ้น แต่ยังตอบเป็นมนุษย์
- ไม่เกิน 220 tokens`;

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

export interface PromptRecord {
  id: string;
  key: string;
  version: string;
  content: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
}

/** ดึง prompt ที่ active สำหรับ key — รองรับ org_id (multi-tenant: org-specific ก่อน global) */
export async function getActivePrompt(
  key: string,
  org_id?: string | null
): Promise<PromptRecord | null> {
  if (org_id) {
    const snapOrg = await db
      .collection(COLLECTION)
      .where("key", "==", key)
      .where("org_id", "==", org_id)
      .where("is_active", "==", true)
      .limit(1)
      .get();
    if (!snapOrg.empty) {
      const d = snapOrg.docs[0]!.data();
      return {
        id: snapOrg.docs[0]!.id,
        key: d.key ?? key,
        version: d.version ?? "1.0.0",
        content: d.content ?? "",
        is_active: true,
        created_at: toISO(d.created_at),
        created_by: d.created_by,
        metadata: d.metadata as Record<string, unknown> | undefined,
      };
    }
  }
  const snap = await db
    .collection(COLLECTION)
    .where("key", "==", key)
    .where("is_active", "==", true)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  return {
    id: snap.docs[0]!.id,
    key: d.key ?? key,
    version: d.version ?? "1.0.0",
    content: d.content ?? "",
    is_active: d.is_active ?? true,
    created_at: toISO(d.created_at),
    created_by: d.created_by,
    metadata: d.metadata as Record<string, unknown> | undefined,
  };
}

/** ดึง prompt ตาม version */
export async function getPromptByVersion(
  key: string,
  version: string
): Promise<PromptRecord | null> {
  const snap = await db
    .collection(COLLECTION)
    .where("key", "==", key)
    .where("version", "==", version)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const d = snap.docs[0]!.data();
  return {
    id: snap.docs[0]!.id,
    key: d.key ?? key,
    version: d.version ?? version,
    content: d.content ?? "",
    is_active: d.is_active ?? false,
    created_at: toISO(d.created_at),
    created_by: d.created_by,
    metadata: d.metadata as Record<string, unknown> | undefined,
  };
}

/** รายการ versions ทั้งหมดสำหรับ key */
export async function listPromptVersions(key: string): Promise<PromptRecord[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("key", "==", key)
    .orderBy("created_at", "desc")
    .limit(50)
    .get();

  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      key: d.key ?? key,
      version: d.version ?? "",
      content: d.content ?? "",
      is_active: d.is_active ?? false,
      created_at: toISO(d.created_at),
      created_by: d.created_by,
      metadata: d.metadata as Record<string, unknown> | undefined,
    };
  });
}

/** Rollback — กำหนด version เป็น active */
export async function rollbackToVersion(
  key: string,
  version: string,
  createdBy?: string
): Promise<boolean> {
  const target = await getPromptByVersion(key, version);
  if (!target) return false;

  const batch = db.batch();
  const all = await db.collection(COLLECTION).where("key", "==", key).get();
  for (const doc of all.docs) {
    batch.update(doc.ref, {
      is_active: doc.id === target.id,
      updated_at: new Date(),
    });
  }
  await batch.commit();
  const { invalidateAICache } = await import("./ai-feedback-loop");
  void invalidateAICache({ scope: "all" });
  return true;
}

/** ดึง content สำหรับใช้ — fallback เป็น default ถ้าไม่มีใน registry */
export async function getPromptContent(
  key: string,
  options?: { version?: string; useDefault?: string; org_id?: string | null }
): Promise<{ content: string; version: string; variant?: string }> {
  if (options?.version) {
    const record = await getPromptByVersion(key, options.version);
    if (record) return { content: record.content, version: record.version };
  }

  // World-class: A/B prompt — ถ้ามีหลาย variants เลือกสุ่ม
  const candidates = await getActivePromptsForAB(key, options?.org_id);
  if (candidates.length > 1) {
    const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
    return {
      content: chosen.content,
      version: chosen.version,
      variant: (chosen.metadata?.ab_variant as string) ?? chosen.version,
    };
  }
  if (candidates.length === 1) {
    const c = candidates[0]!;
    return {
      content: c.content,
      version: c.version,
      variant: (c.metadata?.ab_variant as string) ?? undefined,
    };
  }

  return {
    content: options?.useDefault ?? DEFAULT_ROLE_MANAGER_PROMPT,
    version: "0.0.0-default",
  };
}

/** A/B: ดึง prompts สำหรับ random assignment — org-specific ก่อน global */
async function getActivePromptsForAB(
  key: string,
  org_id?: string | null
): Promise<Array<{ content: string; version: string; metadata?: Record<string, unknown> }>> {
  if (org_id) {
    const orgSnap = await db
      .collection(COLLECTION)
      .where("key", "==", key)
      .where("org_id", "==", org_id)
      .where("is_active", "==", true)
      .limit(10)
      .get();
    if (!orgSnap.empty) {
      return orgSnap.docs.map((doc) => {
        const d = doc.data();
        return {
          content: d.content ?? "",
          version: d.version ?? "1.0.0",
          metadata: d.metadata as Record<string, unknown> | undefined,
        };
      });
    }
  }
  const snap = await db
    .collection(COLLECTION)
    .where("key", "==", key)
    .where("is_active", "==", true)
    .limit(10)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      content: d.content ?? "",
      version: d.version ?? "1.0.0",
      metadata: d.metadata as Record<string, unknown> | undefined,
    };
  });
}
