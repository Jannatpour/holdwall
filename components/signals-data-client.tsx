"use client";

import dynamic from "next/dynamic";
import { SignalsLoading } from "@/components/ui/loading-states";

const SignalsData = dynamic(() => import("@/components/signals-data").then((mod) => ({ default: mod.SignalsData })), {
  loading: () => <SignalsLoading />,
  ssr: false,
});

interface SignalsDataClientProps {
  tabFilter?: "all" | "high-risk" | "unclustered";
}

export function SignalsDataClient({ tabFilter = "all" }: SignalsDataClientProps) {
  return <SignalsData tabFilter={tabFilter} />;
}
