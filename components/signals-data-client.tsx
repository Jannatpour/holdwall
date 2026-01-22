"use client";

import dynamic from "next/dynamic";

const SignalsData = dynamic(() => import("@/components/signals-data").then((mod) => ({ default: mod.SignalsData })), {
  loading: () => <div className="space-y-4"><div className="h-32 w-full bg-muted animate-pulse rounded" /></div>,
  ssr: false,
});

interface SignalsDataClientProps {
  tabFilter?: "all" | "high-risk" | "unclustered";
}

export function SignalsDataClient({ tabFilter = "all" }: SignalsDataClientProps) {
  return <SignalsData tabFilter={tabFilter} />;
}
