/**
 * Timezone Consistency — Asia/Bangkok
 * ทุก daily usage ใช้ YYYY-MM-DD ใน Bangkok
 * ห้ามใช้ UTC default
 */
const BANGKOK_TZ = "Asia/Bangkok";

function toBangkokDate(d: Date = new Date()): Date {
  const str = d.toLocaleString("en-US", { timeZone: BANGKOK_TZ });
  return new Date(str);
}

/**
 * คืนค่า YYYY-MM-DD ของวันนี้ในกรุงเทพ
 */
export function getTodayKeyBangkok(): string {
  const d = toBangkokDate();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * คืนค่า start of day (00:00:00) และ end of day (23:59:59) ใน Bangkok
 */
export function getBangkokDayRange(date?: Date): { start: Date; end: Date } {
  const d = date ? toBangkokDate(date) : toBangkokDate();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}
