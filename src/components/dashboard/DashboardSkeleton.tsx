"use client";

export function KpiPanelSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 bg-white overflow-hidden shadow-card">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-surface-100">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-5 sm:p-6 animate-pulse">
            <div className="h-3 w-16 bg-surface-200 rounded mb-3" />
            <div className="h-7 w-20 bg-surface-200 rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="w-full min-h-[240px] h-60 flex flex-col justify-center animate-pulse" aria-hidden>
      <div className="h-3 w-24 bg-surface-200 rounded mb-4" />
      <div className="flex-1 flex items-end gap-1 px-2 pb-6">
        {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
          <div key={i} className="flex-1 bg-surface-200 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function PieSkeleton() {
  return (
    <div className="w-full min-h-[240px] h-60 flex flex-col items-center justify-center animate-pulse" aria-hidden>
      <div className="w-32 h-32 rounded-full bg-surface-200" />
      <div className="h-3 w-20 bg-surface-200 rounded mt-4" />
    </div>
  );
}
