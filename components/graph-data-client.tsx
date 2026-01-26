"use client";

import dynamic from "next/dynamic";
import { GraphLoading } from "@/components/ui/loading-states";

const GraphDataDynamic = dynamic(() => import("@/components/graph-data").then(mod => ({ default: mod.GraphData })), {
  ssr: false,
  loading: () => <GraphLoading />,
});

export function GraphDataClient({ range, timestamp, nodeId }: { range?: string; timestamp?: string; nodeId?: string }) {
  return <GraphDataDynamic range={range} timestamp={timestamp} nodeId={nodeId} />;
}
