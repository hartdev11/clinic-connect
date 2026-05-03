const REQUIRED_ENV_VARS = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "SESSION_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

const PHASE_ENV_KEYS = [
  "PHASE_G_URL",
  "PHASE_K_URL",
  "PHASE_L_URL",
  "PHASE_I_URL",
  "PHASE_H_URL",
  "PHASE_J_URL",
  "PHASE_M_URL",
  "PHASE_N_URL",
] as const;

function isTruthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validatePhaseEnv(): string[] {
  const issues: string[] = [];

  for (const key of PHASE_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (!value) continue;
    if (!isValidHttpUrl(value)) {
      issues.push(`${key} must be a valid http(s) URL`);
    }
  }

  const forwardToPhaseG = isTruthyFlag(process.env.FORWARD_CHAT_TO_PHASE_G);
  if (forwardToPhaseG && !process.env.PHASE_G_URL?.trim()) {
    issues.push("FORWARD_CHAT_TO_PHASE_G=true requires PHASE_G_URL");
  }

  return issues;
}

export function validateEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
  const phaseIssues = validatePhaseEnv();
  if (missing.length === 0 && phaseIssues.length === 0) return;

  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`Missing required env vars: ${missing.join(", ")}`);
  }
  if (phaseIssues.length > 0) {
    problems.push(`Phase config issues: ${phaseIssues.join("; ")}`);
  }
  const message = `[ENV_VALIDATION] ${problems.join(" | ")}`;
  console.error(message);

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }
}
