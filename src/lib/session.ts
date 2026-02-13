import * as jose from "jose";

const COOKIE_NAME = "clinic_session";
const JWT_EXPIRY = "7d";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return secret;
}

/** E1.6 — JWT payload สำหรับ create */
export interface TokenPayload {
  sub: string;
  email: string;
  org_id?: string | null;
  branch_id?: string | null;
  user_id?: string | null;
}

/** ผลจาก verify — org_id อาจเป็น null (legacy token) */
export type VerifiedPayload = Omit<TokenPayload, "org_id"> & {
  org_id: string | null;
  branch_id: string | null;
  user_id: string | null;
};

export async function createToken(payload: TokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(getSessionSecret());
  const claims: Record<string, unknown> = {
    sub: payload.sub,
    email: payload.email,
  };
  if (payload.org_id) claims.org_id = payload.org_id;
  if (payload.branch_id) claims.branch_id = payload.branch_id;
  if (payload.user_id) claims.user_id = payload.user_id;
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRY)
    .setIssuedAt()
    .sign(secret);
}

export async function verifyToken(token: string): Promise<VerifiedPayload | null> {
  try {
    const secret = new TextEncoder().encode(getSessionSecret());
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub as string;
    const email = payload.email as string;
    const org_id = payload.org_id as string;
    if (!sub || !email) return null;
    return {
      sub,
      email,
      org_id: org_id || null,
      branch_id: (payload.branch_id as string) || null,
      user_id: (payload.user_id as string) || null,
    };
  } catch {
    return null;
  }
}

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export { COOKIE_NAME };
