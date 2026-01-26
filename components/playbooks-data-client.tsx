"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/ui/loading-states";

const PlaybooksData = dynamic(() => import("@/components/playbooks-data").then(mod => ({ default: mod.PlaybooksData })), {
  ssr: false,
  loading: () => <LoadingState count={5} />,
});

interface PlaybooksDataClientProps {
  tab?: "catalog" | "active-runs" | "history";
  executionId?: string;
}

export function PlaybooksDataClient({ tab = "catalog", executionId }: PlaybooksDataClientProps) {
  return <PlaybooksData tab={tab} executionId={executionId} />;
}
