"use client";

import dynamic from "next/dynamic";
import { OverviewLoading } from "@/components/ui/loading-states";

const OverviewData = dynamic(
  () => import("@/components/overview-data").then((mod) => ({ default: mod.OverviewData })),
  {
    ssr: false,
    loading: () => <OverviewLoading />,
  }
);

export function OverviewDataClient() {
  return <OverviewData />;
}
