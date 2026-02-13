import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import path from "path";

let _adminApp: App | null = null;
let _db: Firestore | null = null;

export function getFirebaseAdmin(): App {
  if (_adminApp) return _adminApp;

  const apps = getApps();
  if (apps.length > 0) {
    _adminApp = apps[0] as App;
    return _adminApp;
  }

  // ทางเลือก 1: ใช้ path ไปยังไฟล์ JSON
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    const fs = require("fs");
    const absolutePath = path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.join(process.cwd(), serviceAccountPath);
    const json = fs.readFileSync(absolutePath, "utf8");
    const serviceAccount = JSON.parse(json);
    // ปรับ private_key: แปลง \\n เป็น newline จริง ลบ \r (Windows) และ trim
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .trim();
    }
    _adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
    return _adminApp;
  }

  // ทางเลือก 2: ใช้ env แยก
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r/g, "");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "ต้องตั้งค่า: FIREBASE_SERVICE_ACCOUNT_PATH หรือ FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY ใน .env.local"
    );
  }

  _adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  return _adminApp;
}

function getDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getFirebaseAdmin());
  return _db;
}

export const db = new Proxy({} as Firestore, {
  get(_, prop) {
    return getDb()[prop as keyof Firestore];
  },
});
