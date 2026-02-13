/**
 * FE-8 — Shared fetcher ที่เก็บ error message จาก API (รวม RBAC 403)
 * ใช้แทน throw new Error("Failed to fetch") เพื่อแสดง message ชัดเจน
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof json?.error === "string"
        ? json.error
        : res.status === 401
          ? "กรุณาเข้าสู่ระบบใหม่"
          : res.status === 403
            ? "คุณไม่มีสิทธิ์เข้าถึงรายการนี้"
            : res.status === 404
              ? "ไม่พบรายการ"
              : res.status === 429
                ? "โหลดเร็วเกินไป กรุณารอสักครู่"
                : "โหลดข้อมูลไม่สำเร็จ";
    throw new Error(msg);
  }
  return json as T;
}
