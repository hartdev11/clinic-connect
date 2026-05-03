import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { createToken, COOKIE_NAME, getCookieOptions } from "@/lib/session";
import { db, getFirebaseAdmin } from "@/lib/firebase-admin";
import { verifyPassword } from "@/lib/auth";
import type { UserRole } from "@/types/organization";
import { checkDistributedRateLimit, getClientIp } from "@/lib/distributed-rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

const isDev = process.env.NODE_ENV === "development";

function toUserRole(value: unknown): UserRole | null {
  if (value === "super_admin" || value === "owner" || value === "manager" || value === "staff") {
    return value;
  }
  return null;
}

/** Firebase Identity Toolkit: no email/password account (not wrong password) */
function isAuthUserMissing(error: { message?: string } | undefined): boolean {
  const msg = (error?.message ?? "").toUpperCase();
  return msg.includes("EMAIL_NOT_FOUND") || msg.includes("USER_NOT_FOUND");
}

function isPasswordLoginDisabled(error: { message?: string } | undefined): boolean {
  return (error?.message ?? "").toUpperCase().includes("PASSWORD_LOGIN_DISABLED");
}

async function signInWithPasswordRest(
  apiKey: string,
  email: string,
  password: string
): Promise<{ ok: true; idToken: string; localId: string } | { ok: false; error: { message?: string } }> {
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const signIn = (await signInRes.json().catch(() => ({}))) as {
    idToken?: string;
    localId?: string;
    error?: { message?: string };
  };
  if (!signInRes.ok || !signIn.idToken || !signIn.localId) {
    return { ok: false, error: signIn.error ?? { message: "sign in failed" } };
  }
  return { ok: true, idToken: signIn.idToken, localId: signIn.localId };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const licenseKeyRaw =
      typeof body?.licenseKey === "string"
        ? body.licenseKey.trim()
        : typeof body?.license_key === "string"
          ? body.license_key.trim()
          : "";
    const licenseKey = licenseKeyRaw;
    if (!email || !password) {
      return NextResponse.json({ error: "Email และ Password จำเป็น" }, { status: 400 });
    }
    const ip = getClientIp(request);
    const byIp = await checkDistributedRateLimit(`auth:login:ip:${ip}`, 15, 60);
    if (!byIp.allowed) {
      return NextResponse.json(
        { error: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", retryAfterMs: byIp.retryAfterMs },
        { status: 429 }
      );
    }
    const byEmail = await checkDistributedRateLimit(`auth:login:email:${email}`, 10, 60);
    if (!byEmail.allowed) {
      return NextResponse.json(
        { error: "พยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่", retryAfterMs: byEmail.retryAfterMs },
        { status: 429 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_FIREBASE_API_KEY" }, { status: 503 });
    }

    let signInResult = await signInWithPasswordRest(apiKey, email, password);

    if (!signInResult.ok && isAuthUserMissing(signInResult.error)) {
      const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data() as Record<string, unknown>;
        const storedHash = typeof userData.passwordHash === "string" ? userData.passwordHash : "";
        const valid = storedHash ? await verifyPassword(password, storedHash) : false;
        if (valid) {
          const auth = getAuth(getFirebaseAdmin());
          try {
            await auth.createUser({
              uid: userDoc.id,
              email,
              password,
              emailVerified: false,
            });
          } catch (createErr: unknown) {
            const code = (createErr as { code?: string })?.code;
            if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") {
              console.error("[login] createUser failed:", createErr);
            }
          }
          signInResult = await signInWithPasswordRest(apiKey, email, password);
        }
      }
    }

    if (!signInResult.ok && isPasswordLoginDisabled(signInResult.error)) {
      return firestoreSessionLogin(email, password, licenseKey);
    }

    if (!signInResult.ok && isAuthUserMissing(signInResult.error)) {
      return firestoreSessionLogin(email, password, licenseKey);
    }

    if (!signInResult.ok) {
      const fs = await firestoreSessionLogin(email, password, licenseKey);
      if (fs.status === 200) return fs;
      return NextResponse.json(
        { error: signInResult.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ" },
        { status: 401 }
      );
    }

    const auth = getAuth(getFirebaseAdmin());
    const decoded = await auth.verifyIdToken(signInResult.idToken);

    const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
    if (userSnap.empty) {
      return NextResponse.json({ error: "ไม่พบบัญชีผู้ใช้ในระบบ" }, { status: 403 });
    }
    const user = userSnap.docs[0].data() as Record<string, unknown>;
    const orgId =
      (typeof user.org_id === "string" && user.org_id) ||
      (typeof decoded.org_id === "string" && decoded.org_id) ||
      (typeof decoded.tenant_id === "string" && decoded.tenant_id) ||
      null;
    if (!orgId) {
      return NextResponse.json({ error: "ไม่พบบัญชีองค์กร" }, { status: 403 });
    }
    if (licenseKey) {
      const orgDoc = await db.collection("organizations").doc(orgId).get();
      const orgLicense = (orgDoc.data()?.license_key ?? orgDoc.data()?.licenseKey ?? "").toString().trim();
      if (orgLicense && orgLicense !== licenseKey) {
        return NextResponse.json({ error: "License key ไม่ถูกต้อง" }, { status: 403 });
      }
    }

    const sessionToken = await createToken({
      sub: signInResult.localId,
      email,
      tenant_id: orgId,
      org_id: orgId,
      branch_id: typeof user.default_branch_id === "string" ? user.default_branch_id : null,
      user_id: userSnap.docs[0].id,
      role: toUserRole(user.role),
    });

    const response = NextResponse.json({
      ok: true,
      token: signInResult.idToken,
      authMode: "firebase_id_token",
      user: {
        id: userSnap.docs[0].id,
        email,
        org_id: orgId,
        branch_id: typeof user.default_branch_id === "string" ? user.default_branch_id : null,
        role: typeof user.role === "string" ? user.role : null,
      },
    });
    response.cookies.set(COOKIE_NAME, sessionToken, getCookieOptions());
    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Auth service unavailable" }, { status: 503 });
  }
}

async function firestoreSessionLogin(
  email: string,
  password: string,
  licenseKey: string
): Promise<NextResponse> {
  const userSnap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (userSnap.empty) {
    return NextResponse.json(
      {
        error: "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจอีเมลและรหัสผ่าน",
        ...(isDev ? { code: "USER_NOT_IN_FIRESTORE" as const } : {}),
      },
      { status: 401 }
    );
  }
  const userDoc = userSnap.docs[0];
  const userData = userDoc.data() as Record<string, unknown>;
  const storedHash = typeof userData.passwordHash === "string" ? userData.passwordHash : "";
  const valid = storedHash ? await verifyPassword(password, storedHash) : false;
  if (!valid) {
    return NextResponse.json(
      {
        error: "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจอีเมลและรหัสผ่าน",
        ...(isDev ? { code: "INVALID_PASSWORD" as const } : {}),
      },
      { status: 401 }
    );
  }

  const orgId = typeof userData.org_id === "string" ? userData.org_id : null;
  if (!orgId) {
    return NextResponse.json({ error: "ไม่พบบัญชีองค์กร" }, { status: 403 });
  }
  if (licenseKey) {
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgLicense = (orgDoc.data()?.license_key ?? orgDoc.data()?.licenseKey ?? "").toString().trim();
    if (orgLicense && orgLicense !== licenseKey) {
      return NextResponse.json({ error: "License key ไม่ถูกต้อง" }, { status: 403 });
    }
  }

  const sessionToken = await createToken({
    sub: userDoc.id,
    email,
    tenant_id: orgId,
    org_id: orgId,
    branch_id: typeof userData.default_branch_id === "string" ? userData.default_branch_id : null,
    user_id: userDoc.id,
    role: toUserRole(userData.role),
  });

  const response = NextResponse.json({
    ok: true,
    token: null,
    authMode: "session_only",
    hint:
      "Firebase Email/Password sign-in is disabled or unavailable; session cookie issued from Firestore. Enable Email/Password in Firebase Console for full Firebase Auth.",
    user: {
      id: userDoc.id,
      email,
      org_id: orgId,
      branch_id: typeof userData.default_branch_id === "string" ? userData.default_branch_id : null,
      role: typeof userData.role === "string" ? userData.role : null,
    },
  });
  response.cookies.set(COOKIE_NAME, sessionToken, getCookieOptions());
  return response;
}
