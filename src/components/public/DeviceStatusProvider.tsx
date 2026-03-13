"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface DeviceStatus {
  hasPurchased: boolean;
  emailVerified: boolean;
  email: string | null;
  plan: string | null;
  loading: boolean;
}

const defaultStatus: DeviceStatus = {
  hasPurchased: false,
  emailVerified: false,
  email: null,
  plan: null,
  loading: true,
};

const DeviceStatusContext = createContext<DeviceStatus>(defaultStatus);

export function DeviceStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DeviceStatus>(defaultStatus);

  useEffect(() => {
    let cancelled = false;
    setStatus((s) => ({ ...s, loading: true }));
    fetch("/api/public/device-status", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setStatus({
          hasPurchased: Boolean(data.hasPurchased),
          emailVerified: Boolean(data.emailVerified),
          email: data.email ?? null,
          plan: data.plan ?? null,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setStatus((s) => ({ ...s, loading: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DeviceStatusContext.Provider value={status}>
      {children}
    </DeviceStatusContext.Provider>
  );
}

export function useDeviceStatus(): DeviceStatus {
  return useContext(DeviceStatusContext);
}
