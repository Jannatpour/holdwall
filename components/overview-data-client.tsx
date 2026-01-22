"use client";

import dynamic from "next/dynamic";

const OverviewData = dynamic(
  () => import("@/components/overview-data").then((mod) => ({ default: mod.OverviewData })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 w-full bg-muted animate-pulse rounded" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 w-full bg-muted animate-pulse rounded" />
          <div className="h-64 w-full bg-muted animate-pulse rounded" />
        </div>
        <div className="h-48 w-full bg-muted animate-pulse rounded" />
      </div>
    ),
  }
);

export function OverviewDataClient() {
  return <OverviewData />;
}
