/**
 * การคำนวณเงิน — ใช้ integer (satang) เพื่อหลีกเลี่ยง floating-point error
 * 1 บาท = 100 สตางค์
 *
 * Convention:
 * - เก็บใน Firestore: หน่วยบาท (เช่น 2500.50) — backward compatible
 * - คำนวณ: แปลงเป็น satang (integer) ก่อน sum
 * - คืนค่า API: หน่วยบาท (number) สำหรับ display
 */
const SATANG_PER_BAHT = 100;

/**
 * แปลงค่าจาก DB (บาท หรือ mixed) เป็น satang (integer)
 * ป้องกัน float และ NaN
 */
export function toSatang(value: unknown): number {
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.round(n * SATANG_PER_BAHT);
}

/**
 * รวม amount (จาก DB) เป็น satang — ใช้ integer summation
 */
export function sumToSatang(values: unknown[]): number {
  return values.reduce<number>((acc, v) => acc + toSatang(v), 0);
}

/**
 * แปลง satang เป็นบาท (สำหรับ display / API response)
 */
export function satangToBaht(satang: number): number {
  return Math.round(satang) / SATANG_PER_BAHT;
}

/**
 * รวม amount array แล้วคืนค่าเป็นบาท (safe integer math)
 */
export function safeSumBaht(values: unknown[]): number {
  const satang = sumToSatang(values);
  return satangToBaht(satang);
}

/**
 * บวก amount สองค่า (หน่วยบาท) โดยใช้ integer math
 */
export function safeAddBaht(a: number, b: number): number {
  return satangToBaht(toSatang(a) + toSatang(b));
}
