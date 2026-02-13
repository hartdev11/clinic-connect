/**
 * Encryption at Rest — Enterprise Compliance
 * Firestore (Google Cloud) มี encryption at rest ตาม default
 * @see https://cloud.google.com/firestore/docs/server-side-encryption
 */
export const ENCRYPTION_INFO = {
  firestore: {
    provider: "Google Cloud Firestore",
    at_rest: true,
    note: "Firestore encrypts all data at rest by default (AES-256)",
  },
  session: {
    provider: "JWT (jose)",
    storage: "HttpOnly Cookie",
    note: "Session token is signed, not encrypted. Sensitive data เก็บใน DB.",
  },
} as const;
