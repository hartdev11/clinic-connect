/**
 * Firebase Realtime Auth — sign in with custom token สำหรับ Realtime Listeners
 * ดึง token จาก session API แล้ว signInWithCustomToken
 */
import { useState, useEffect } from "react";
import { signInWithCustomToken, onAuthStateChanged, type User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigReady } from "@/lib/firebase-client";

export interface FirebaseRealtimeState {
  ready: boolean;
  orgId: string | null;
  user: User | null;
  error: string | null;
  signedIn: boolean;
}

export function useFirebaseRealtime(): FirebaseRealtimeState {
  const [state, setState] = useState<FirebaseRealtimeState>({
    ready: false,
    orgId: null,
    user: null,
    error: null,
    signedIn: false,
  });

  useEffect(() => {
    if (!isFirebaseConfigReady()) {
      setState((s) => ({ ...s, ready: true, error: "Firebase config not set" }));
      return;
    }

    let mounted = true;
    const auth = getFirebaseAuth();

    const unsub = onAuthStateChanged(auth, (user) => {
      if (!mounted) return;
      setState((s) => ({ ...s, user, signedIn: !!user }));
    });

    (async () => {
      try {
        const res = await fetch("/api/auth/firebase-token", { credentials: "include" });
        if (!mounted) return;
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Failed to get Firebase token");
        }
        const { token, org_id } = await res.json();
        await signInWithCustomToken(auth, token);
        if (mounted) {
          setState((s) => ({ ...s, orgId: org_id, ready: true, signedIn: true, error: null }));
        }
      } catch (err) {
        if (mounted) {
          setState((s) => ({ ...s, ready: true, error: (err as Error).message }));
        }
      }
    })();
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return state;
}
