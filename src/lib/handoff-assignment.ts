/**
 * Enterprise — Smart Staff Assignment
 * เลือก staff ที่มี active handoffs น้อยที่สุด
 */
import { db } from "@/lib/firebase-admin";
import { getUsersByOrgId } from "@/lib/clinic-data";

const HANDOFF_SUB = "handoff_sessions";

/** Get active handoff counts per staff (status accepted or active) */
async function getActiveHandoffCountsByStaff(
  orgId: string
): Promise<Map<string, number>> {
  const accepted = await db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .where("status", "==", "accepted")
    .get();
  const active = await db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .where("status", "==", "active")
    .get();
  const map = new Map<string, number>();
  for (const d of accepted.docs) {
    const sid = d.data()?.assignedStaffId as string | undefined;
    if (sid) map.set(sid, (map.get(sid) ?? 0) + 1);
  }
  for (const d of active.docs) {
    const sid = d.data()?.assignedStaffId as string | undefined;
    if (sid) map.set(sid, (map.get(sid) ?? 0) + 1);
  }
  return map;
}

/** Assign best staff to handoff session and create notification */
export async function assignBestStaff(
  orgId: string,
  handoffId: string
): Promise<string | null> {
  const users = await getUsersByOrgId(orgId);
  const staff = users.filter((u) =>
    ["staff", "manager", "owner"].includes(u.role)
  );
  if (staff.length === 0) return null;

  const countsMap = await getActiveHandoffCountsByStaff(orgId);
  const counts = staff.map((u) => ({
    userId: u.id,
    name: u.name ?? u.email,
    count: countsMap.get(u.id) ?? 0,
  }));

  const minCount = Math.min(...counts.map((c) => c.count));
  const candidates = counts.filter((c) => c.count === minCount);
  const picked =
    candidates.length > 1
      ? candidates[Math.floor(Math.random() * candidates.length)]
      : candidates[0];
  if (!picked) return null;

  const { FieldValue } = await import("firebase-admin/firestore");
  const ref = db
    .collection("organizations")
    .doc(orgId)
    .collection(HANDOFF_SUB)
    .doc(handoffId);
  const doc = await ref.get();
  if (!doc.exists || doc.data()?.status !== "pending") return null;

  await ref.update({
    assignedStaffId: picked.userId,
    assignedStaffName: picked.name,
    updatedAt: FieldValue.serverTimestamp(),
  });

  await db
    .collection("organizations")
    .doc(orgId)
    .collection("notifications")
    .add({
      type: "handoff_assigned",
      handoffSessionId: handoffId,
      staffId: picked.userId,
      message: `คุณได้รับมอบหมาย handoff #${handoffId.slice(0, 8)}`,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });

  return picked.userId;
}
