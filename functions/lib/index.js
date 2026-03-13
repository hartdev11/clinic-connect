"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyLicense = void 0;
/**
 * Enterprise: License verification ต้องผ่าน Cloud Function เท่านั้น
 * ใช้ HTTP function เพื่อให้ Next.js เรียกจาก server ได้ (ส่ง secret ใน header)
 */
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const LICENSES_COLLECTION = "licenses";
const HEADER_SECRET = "x-license-verify-secret";
function hashLicenseKey(plainKey) {
    const normalized = plainKey.trim().toUpperCase().replace(/\s/g, "");
    return (0, crypto_1.createHash)("sha256").update(normalized).digest("hex");
}
exports.verifyLicense = (0, https_1.onRequest)({ region: "asia-southeast1" }, async (req, res) => {
    var _a, _b, _c, _d, _e;
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ valid: false, reason: "Method not allowed" });
        return;
    }
    const secret = process.env.LICENSE_VERIFY_SECRET;
    const headerSecret = (_a = req.headers[HEADER_SECRET]) !== null && _a !== void 0 ? _a : req.headers[HEADER_SECRET.toLowerCase()];
    if (!secret || headerSecret !== secret) {
        res.status(401).json({ valid: false, reason: "Unauthorized" });
        return;
    }
    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : (_b = req.body) !== null && _b !== void 0 ? _b : {};
    }
    catch (_f) {
        res.status(400).json({ valid: false, reason: "Invalid JSON" });
        return;
    }
    const plainKey = typeof body.licenseKey === "string" ? body.licenseKey.trim() : "";
    if (plainKey.length < 10) {
        res.status(400).json({ valid: false, reason: "รหัสใบอนุญาตไม่ถูกต้อง" });
        return;
    }
    const keyHash = hashLicenseKey(plainKey);
    const snap = await db
        .collection(LICENSES_COLLECTION)
        .where("licenseKeyHash", "==", keyHash)
        .limit(1)
        .get();
    if (snap.empty) {
        res.status(400).json({ valid: false, reason: "ไม่พบรหัสใบอนุญาตนี้" });
        return;
    }
    const doc = snap.docs[0];
    const d = doc.data();
    const usedAt = (_c = d.usedAt) !== null && _c !== void 0 ? _c : null;
    const orgId = (_d = d.orgId) !== null && _d !== void 0 ? _d : null;
    if (usedAt || orgId) {
        res.status(400).json({ valid: false, reason: "รหัสใบอนุญาตนี้ถูกใช้งานแล้ว" });
        return;
    }
    const plan = (_e = d.plan) !== null && _e !== void 0 ? _e : "basic";
    res.status(200).json({
        valid: true,
        plan,
        licenseId: doc.id,
    });
});
