"use client";

import dynamic from "next/dynamic";

const PlaybooksData = dynamic(() => import("@/components/playbooks-data").then(mod => ({ default: mod.PlaybooksData })), {
  ssr: false,
  loading: () => <div className="space-y-4"><div className="h-32 w-full bg-muted animate-pulse rounded" /></div>,
});

interface PlaybooksDataClientProps {
  tab?: "catalog" | "active-runs" | "history";
  executionId?: string;
}

export function PlaybooksDataClient({ tab = "catalog", executionId }: PlaybooksDataClientProps) {
  return <PlaybooksData tab={tab} executionId={executionId} />;
}
