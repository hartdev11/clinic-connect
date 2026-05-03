import { getDashboardBookingsByDate, getDashboardStats } from "@/lib/clinic-data";

export async function getLocalOwnerDashboard(orgId: string, branchId?: string | null): Promise<{
  overview: { total_revenue: number; total_bookings: number; total_sessions: number };
  top_procedures: Array<{ service_name: string; total_bookings: number; total_revenue: number }>;
}> {
  const [stats, bookingsByDate] = await Promise.all([
    getDashboardStats(orgId, branchId ?? undefined),
    getDashboardBookingsByDate(orgId, branchId ?? undefined),
  ]);

  const byService = new Map<string, number>();
  for (const group of bookingsByDate) {
    for (const item of group.items ?? []) {
      const key = (item.service ?? "").trim() || "บริการทั่วไป";
      byService.set(key, (byService.get(key) ?? 0) + 1);
    }
  }
  const top_procedures = [...byService.entries()]
    .map(([service_name, total_bookings]) => ({
      service_name,
      total_bookings,
      total_revenue: 0,
    }))
    .sort((a, b) => b.total_bookings - a.total_bookings)
    .slice(0, 5);

  return {
    overview: {
      total_revenue: Number(stats.revenueThisMonth ?? 0),
      total_bookings: Number(stats.bookingsToday ?? 0),
      total_sessions: Number(stats.chatsToday ?? 0),
    },
    top_procedures,
  };
}
