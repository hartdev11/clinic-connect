import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken, COOKIE_NAME } from "@/lib/session";
import { getUserById, getOrgIdFromClinicId } from "@/lib/clinic-data";

const ADMIN_ROLES = ["owner"];

export default async function KnowledgeHealthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) redirect("/login");
  const payload = await verifyToken(token);
  if (!payload) redirect("/login");
  const orgId = payload.org_id ?? (await getOrgIdFromClinicId(payload.sub));
  if (!orgId) redirect("/clinic");
  const userId = payload.user_id ?? payload.sub;
  const user = await getUserById(userId);
  let isOwner = false;
  if (user && user.org_id === orgId && ADMIN_ROLES.includes(user.role)) isOwner = true;
  if (!isOwner) {
    const { db } = await import("@/lib/firebase-admin");
    const orgDoc = await db.collection("organizations").doc(orgId).get();
    const orgData = orgDoc.data();
    if (orgDoc.exists && orgData?.email?.toLowerCase() === payload.email?.toLowerCase()) isOwner = true;
  }
  if (!isOwner) redirect("/clinic");
  return <>{children}</>;
}
