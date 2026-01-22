"use client";

import dynamic from "next/dynamic";

const FunnelSimulatorDynamic = dynamic(() => import("@/components/funnel-simulator").then(mod => ({ default: mod.FunnelSimulator })), {
  ssr: false,
  loading: () => <div className="h-[500px] rounded-lg border bg-muted/20 flex items-center justify-center">
    <div className="text-muted-foreground">Loading funnel simulator...</div>
  </div>,
});

export function FunnelSimulatorClient({ persona }: { persona?: string }) {
  return <FunnelSimulatorDynamic persona={persona || "buyer"} />;
}
