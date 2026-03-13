/**
 * Phase 9 — Coupons
 * Firestore: global/pricing_packages/coupons/{code}
 */
import { db } from "@/lib/firebase-admin";
import type { Coupon, CouponCreate } from "@/types/pricing";

const GLOBAL_COL = "global";
const DOC_ID = "pricing_packages";
const SUB_COL = "coupons";

function toISO(t: unknown): string {
  if (typeof t === "string") return t;
  if (t instanceof Date) return t.toISOString();
  const d = (t as { toDate?: () => Date })?.toDate?.();
  return d ? d.toISOString() : "";
}

function couponsRef() {
  return db.collection(GLOBAL_COL).doc(DOC_ID).collection(SUB_COL);
}

function mapDoc(id: string, d: Record<string, unknown>): Coupon {
  return {
    id,
    couponCode: (d.couponCode as string) ?? id,
    discountType: (d.discountType as Coupon["discountType"]) ?? "percentage",
    discountValue: typeof d.discountValue === "number" ? d.discountValue : 0,
    validFrom: toISO(d.validFrom),
    validUntil: toISO(d.validUntil),
    maxTotalUses: typeof d.maxTotalUses === "number" ? d.maxTotalUses : 0,
    currentUses: typeof d.currentUses === "number" ? d.currentUses : 0,
    isActive: !!(d.isActive ?? true),
  };
}

export async function listCoupons(): Promise<Coupon[]> {
  const snap = await couponsRef().orderBy("couponCode", "asc").get();
  return snap.docs.map((doc) => mapDoc(doc.id, doc.data()));
}

export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const normalized = code.trim().toUpperCase();
  const snap = await couponsRef().where("couponCode", "==", normalized).limit(1).get();
  if (snap.empty) return null;
  return mapDoc(snap.docs[0].id, snap.docs[0].data());
}

export async function createCoupon(data: CouponCreate): Promise<string> {
  const code = data.couponCode.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) throw new Error("couponCode required");
  const ref = couponsRef().doc(code);
  const exists = await ref.get();
  if (exists.exists) throw new Error("Coupon code already exists");
  await ref.set({
    couponCode: code,
    discountType: data.discountType,
    discountValue: data.discountValue,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
    maxTotalUses: data.maxTotalUses ?? 0,
    currentUses: 0,
    isActive: data.isActive !== false,
  });
  return code;
}

export async function incrementCouponUses(code: string): Promise<boolean> {
  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = couponsRef().doc(code);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const d = doc.data()!;
  const max = (d.maxTotalUses as number) ?? 0;
  const current = (d.currentUses as number) ?? 0;
  if (max > 0 && current >= max) return false;
  await ref.update({
    currentUses: FieldValue.increment(1),
  });
  return true;
}
