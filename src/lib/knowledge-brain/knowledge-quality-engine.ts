/**
 * Enterprise Knowledge Brain — Knowledge Quality Scoring Engine
 * Phase 2 #13: คะแนน 0–100, grade A/B/C/D, บล็อก approve ถ้า < 70
 */
import type {
  GlobalKnowledge,
  ClinicKnowledge,
  StructuredKnowledgeContext,
  KnowledgeQualityGrade,
} from "@/types/knowledge-brain";

const MIN_APPROVE_SCORE = 70;
const MIN_DESCRIPTION_LENGTH = 100;
const OPTIMAL_DESCRIPTION_LENGTH = 300;
const DUPLICATE_RISK_PENALTY = 15;

export interface KnowledgeQualityResult {
  score: number;
  grade: KnowledgeQualityGrade;
  canApprove: boolean;
  breakdown: {
    field_completeness: number;
    risks_contraindications: number;
    length_depth: number;
    clarity: number;
    duplication_risk: number;
    policy_compliance: number;
  };
  warnings: string[];
}

function gradeFromScore(score: number): KnowledgeQualityGrade {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "D";
}

/** Field completeness — ตรวจว่ามีค่าทุก field ที่จำเป็น */
function scoreFieldCompleteness(
  global: GlobalKnowledge,
  clinic: ClinicKnowledge | null
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let filled = 0;
  const required = [
    { v: global.service_name, n: "service_name" },
    { v: global.category, n: "category" },
    { v: global.description, n: "description" },
    { v: global.suitable_for?.length, n: "suitable_for" },
    { v: global.not_suitable_for?.length, n: "not_suitable_for" },
    { v: global.procedure_steps?.length, n: "procedure_steps" },
    { v: global.recovery_time, n: "recovery_time" },
    { v: global.results_timeline, n: "results_timeline" },
  ];
  for (const r of required) {
    const ok = Array.isArray(r.v) ? (r.v as unknown[]).length > 0 : Boolean(r.v?.toString?.()?.trim?.());
    if (ok) filled++;
    else warnings.push(`กรุณากรอก ${r.n}`);
  }
  const score = required.length > 0 ? Math.round((filled / required.length) * 100) : 100;
  return { score: Math.min(100, score), warnings };
}

/** Risks & contraindications — ตรวจว่ามีการระบุความเสี่ยงชัดเจน */
function scoreRisksContraindications(global: GlobalKnowledge): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  let score = 100;
  if (!global.risks?.length) {
    score -= 30;
    warnings.push("ควรระบุความเสี่ยงและข้อควรระวัง");
  }
  if (!global.contraindications?.length) {
    score -= 20;
    warnings.push("ควรระบุข้อห้ามใช้");
  }
  return { score: Math.max(0, score), warnings };
}

/** Length & depth — ยิ่งมีเนื้อหามาก ยิ่งได้คะแนน */
function scoreLengthDepth(global: GlobalKnowledge): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const len = (global.description ?? "").length;
  let score = 50;
  if (len >= MIN_DESCRIPTION_LENGTH) score += 25;
  if (len >= OPTIMAL_DESCRIPTION_LENGTH) score += 25;
  if (len < MIN_DESCRIPTION_LENGTH) {
    warnings.push(`รายละเอียดควรมีความยาวอย่างน้อย ${MIN_DESCRIPTION_LENGTH} ตัวอักษร`);
  }
  const faqCount = global.default_FAQ?.length ?? 0;
  if (faqCount >= 3) score = Math.min(100, score + 10);
  return { score: Math.min(100, score), warnings };
}

/** Clarity — ตรวจคำห้าม/รูปแบบที่สับสน (rule-based) */
function scoreClarity(global: GlobalKnowledge): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const text = [
    global.description,
    ...(global.risks ?? []),
    ...(global.contraindications ?? []),
  ].join(" ");
  const bad = [/รับประกัน\s*100%|รับประกันแน่นอน|ปลอดภัยแน่นอน/i];
  for (const p of bad) {
    if (p.test(text)) {
      return { score: 0, warnings: ["ห้ามใช้คำรับประกัน 100% หรือคำคล้ายกัน"] };
    }
  }
  return { score: 100, warnings };
}

/** Policy compliance — ตรงกับกฎกลาง */
function scorePolicyCompliance(
  text: string,
  _global: GlobalKnowledge
): { score: number; warnings: string[] } {
  const warnings: string[] = [];
  const prohibited = [/วินิจฉัยว่า|diagnos.*as|เป็นโรค\s+แน่นอน/i, /รับประกันผล|100%\s*ปลอดภัย/i];
  for (const p of prohibited) {
    if (p.test(text)) {
      return { score: 0, warnings: ["ตรวจพบคำที่ฝ่าฝืนนโยบาย"] };
    }
  }
  return { score: 100, warnings };
}

/**
 * คำนวณคะแนนคุณภาพ knowledge
 */
export function computeKnowledgeQualityScore(
  global: GlobalKnowledge,
  clinic: ClinicKnowledge | null,
  ctx: StructuredKnowledgeContext,
  opts?: { similarityScore?: number }
): KnowledgeQualityResult {
  const allWarnings: string[] = [];
  const fc = scoreFieldCompleteness(global, clinic);
  const rc = scoreRisksContraindications(global);
  const ld = scoreLengthDepth(global);
  const cl = scoreClarity(global);
  const text = [ctx.service_name, ctx.category, global.description].join(" ");
  const pc = scorePolicyCompliance(text, global);

  allWarnings.push(...fc.warnings, ...rc.warnings, ...ld.warnings, ...cl.warnings, ...pc.warnings);

  let dupScore = 100;
  if (opts?.similarityScore !== undefined && opts.similarityScore > 0.92) {
    dupScore = Math.max(0, 100 - DUPLICATE_RISK_PENALTY);
    allWarnings.push("ตรวจพบความคล้ายคลึงกับ knowledge อื่นสูง — อาจเป็นรายการซ้ำ");
  }

  const weights = { fc: 0.2, rc: 0.2, ld: 0.15, cl: 0.2, pc: 0.15, dup: 0.1 };
  const raw =
    fc.score * weights.fc +
    rc.score * weights.rc +
    ld.score * weights.ld +
    cl.score * weights.cl +
    pc.score * weights.pc +
    dupScore * weights.dup;
  const score = Math.round(Math.min(100, Math.max(0, raw)));
  const grade = gradeFromScore(score);
  const canApprove = score >= MIN_APPROVE_SCORE && clinic?.status === "pending_review";

  return {
    score,
    grade,
    canApprove,
    breakdown: {
      field_completeness: fc.score,
      risks_contraindications: rc.score,
      length_depth: ld.score,
      clarity: cl.score,
      duplication_risk: dupScore,
      policy_compliance: pc.score,
    },
    warnings: [...new Set(allWarnings)],
  };
}

export { MIN_APPROVE_SCORE };
