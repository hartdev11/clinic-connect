/**
 * Beauty-clinic conversation dataset (5k examples) — keyword / intent matching for LINE few-shot.
 * No vector search; data is loaded once at module init (server-only).
 */
import datasetJson from "@/data/dataset_5k.json";

export type DatasetRow = {
  text: string;
  metadata: {
    intent_id?: string;
    segment_id?: string;
    voice_id?: string;
    has_cta?: string;
    is_first_message?: string;
    [key: string]: string | undefined;
  };
};

export type DatasetMatch = {
  intentId: string;
  user: string;
  assistant: string;
  /** Original combined text (for debugging) */
  rawText: string;
  score: number;
};

const DATASET: DatasetRow[] = datasetJson as DatasetRow[];

const INTENT_BOOST = 100;
const MAX_RESULTS = 3;

/** Parse "intent: …\nuser: …\nassistant: …" */
export function parseDatasetText(raw: string): { intentId: string; user: string; assistant: string } {
  const aIdx = raw.indexOf("\nassistant:");
  if (aIdx === -1) {
    return { intentId: "", user: "", assistant: raw.trim() };
  }
  const assistant = raw.slice(aIdx + "\nassistant:".length).trim();
  const head = raw.slice(0, aIdx);
  const intentM = head.match(/^intent:\s*(\S+)/m);
  const intentId = intentM?.[1]?.trim() ?? "";
  const userM = head.match(/\nuser:\s*([\s\S]*)$/);
  const user = userM?.[1]?.trim() ?? "";
  return { intentId, user, assistant };
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase();
}

/** Tokens: Latin words >=2 chars; Thai/other scripts kept as split chunks */
function extractKeywords(message: string): string[] {
  const n = normalizeForMatch(message);
  const out = new Set<string>();
  for (const part of n.split(/[\s,.!?:;'"()[\]/\\]+/)) {
    const t = part.trim();
    if (t.length >= 2) out.add(t);
  }
  if (message.trim().length >= 3) {
    out.add(message.trim().slice(0, 80));
  }
  return [...out];
}

function scoreRecord(
  row: DatasetRow,
  keywords: string[],
  haystack: string,
  userMessage: string,
  intentFilter: string | null | undefined
): number {
  const metaIntent = row.metadata?.intent_id?.trim();
  let score = 0;

  if (intentFilter && metaIntent === intentFilter) {
    score += INTENT_BOOST;
  }

  const fullNorm = normalizeForMatch(userMessage).trim();
  if (fullNorm.length >= 3 && haystack.includes(fullNorm)) {
    score += 25;
  }

  for (const kw of keywords) {
    if (kw.length < 2) continue;
    if (haystack.includes(kw.toLowerCase())) {
      score += kw.length >= 8 ? 4 : 2;
    }
  }

  return score;
}

/**
 * Find the most relevant examples using intent (optional) + keyword overlap on full record text.
 * Returns up to 3 examples, sorted by score descending.
 */
export function searchDataset(userMessage: string, intent?: string | null): DatasetMatch[] {
  const intentFilter = intent?.trim() || null;
  const keywords = extractKeywords(userMessage);

  const scored: DatasetMatch[] = [];

  for (const row of DATASET) {
    const haystack = normalizeForMatch(row.text);
    const s = scoreRecord(row, keywords, haystack, userMessage, intentFilter);
    if (s <= 0) continue;

    const parsed = parseDatasetText(row.text);
    scored.push({
      intentId: parsed.intentId,
      user: parsed.user,
      assistant: parsed.assistant,
      rawText: row.text,
      score: s,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTS);
}

/**
 * Few-shot block for system prompt (Thai labels).
 */
export function formatExamplesForPrompt(matches: DatasetMatch[]): string {
  if (matches.length === 0) return "";
  const blocks = matches.map((m, i) => {
    const u = m.user.replace(/\s+/g, " ").trim();
    const a = m.assistant.replace(/\s+/g, " ").trim();
    return `--- ตัวอย่างที่ ${i + 1} (intent ${m.intentId || "?"}) ---\nผู้ใช้: ${u}\nแอดมิน: ${a}`;
  });
  return (
    "ด้านล่างเป็นตัวอย่างบทสนทนาจากแอดมินคลินิกจริง ให้เลียนแบบโทน ความสุภาพ และความกระชับ (ไม่เกินประมาณ 3 ประโยค) แต่ตอบให้ตรงกับคำถามลูกค้าปัจจุบัน:\n\n" +
    blocks.join("\n\n")
  );
}

export function getDatasetSize(): number {
  return DATASET.length;
}
