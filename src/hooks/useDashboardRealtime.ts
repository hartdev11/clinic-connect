/**
 * Phase 21 — Real-time dashboard metrics via Firestore onSnapshot
 * Subscribes to today's metrics, pending handoffs, hot leads count
 */
import { useState, useEffect } from "react";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { getFirebaseFirestore, isFirebaseConfigReady } from "@/lib/firebase-client";
import { useFirebaseRealtime } from "./useFirebaseRealtime";
import { getDateKeyBangkokDaysAgo } from "@/lib/timezone";

export interface DashboardRealtimeState {
  todayMetrics: {
    bookings?: number;
    totalConversations?: number;
    estimatedRevenue?: number;
  } | null;
  pendingHandoffs: number;
  hotLeadsCount: number;
  isLive: boolean;
}

export function useDashboardRealtime(): DashboardRealtimeState {
  const firebase = useFirebaseRealtime();
  const today = getDateKeyBangkokDaysAgo(0);

  const [state, setState] = useState<DashboardRealtimeState>({
    todayMetrics: null,
    pendingHandoffs: 0,
    hotLeadsCount: 0,
    isLive: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigReady() || !firebase.ready || !firebase.orgId || !firebase.signedIn) {
      return;
    }

    const db = getFirebaseFirestore();
    const orgId = firebase.orgId;

    const unsubs: Array<() => void> = [];

    const metricsRef = doc(db, "organizations", orgId, "metrics", today);
    unsubs.push(
      onSnapshot(
        metricsRef,
        (snap) => {
          if (snap.exists()) {
            const d = snap.data();
            setState((s) => ({
              ...s,
              todayMetrics: {
                bookings: d?.bookings,
                totalConversations: d?.totalConversations,
                estimatedRevenue: d?.estimatedRevenue,
              },
              isLive: true,
            }));
          }
        },
        () => {}
      )
    );

    const handoffsRef = collection(db, "organizations", orgId, "handoff_sessions");
    const handoffsQ = query(handoffsRef, where("status", "==", "pending"));
    unsubs.push(
      onSnapshot(
        handoffsQ,
        (snap) => {
          setState((s) => ({ ...s, pendingHandoffs: snap.size, isLive: true }));
        },
        () => {}
      )
    );

    const customersRef = collection(db, "customers");
    const hotLeadsQ = query(
      customersRef,
      where("org_id", "==", orgId),
      where("leadScore", ">=", 0.6)
    );
    unsubs.push(
      onSnapshot(
        hotLeadsQ,
        (snap) => {
          setState((s) => ({ ...s, hotLeadsCount: snap.size, isLive: true }));
        },
        () => {}
      )
    );

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [firebase.ready, firebase.orgId, firebase.signedIn, today]);

  return state;
}
