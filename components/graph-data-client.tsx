"use client";

import dynamic from "next/dynamic";

const GraphDataDynamic = dynamic(() => import("@/components/graph-data").then(mod => ({ default: mod.GraphData })), {
  ssr: false,
  loading: () => <div className="h-[600px] rounded-lg border bg-muted/20 flex items-center justify-center">
    <div className="text-muted-foreground">Loading graph...</div>
  </div>,
});

export function GraphDataClient({ range, timestamp, nodeId }: { range?: string; timestamp?: string; nodeId?: string }) {
  return <GraphDataDynamic range={range} timestamp={timestamp} nodeId={nodeId} />;
}
