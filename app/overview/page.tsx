import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { OverviewDataClient } from "@/components/overview-data-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { OverviewLoading } from "@/components/ui/loading-states";

export const metadata: Metadata = {
  title: "Overview | Holdwall POS",
  description: "Narrative risk brief and recommended actions.",
};

export default async function OverviewPage() {
  return (
    <AppShell>
      <GuideWalkthrough pageId="overview" />
      <div className="space-y-6">
        <div className="flex items-start justify-between" data-guide="overview-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Narrative risk brief and recommended actions powered by advanced AI
            </p>
          </div>
          <GuideButton pageId="overview" />
        </div>
        
        {/* Main Overview Data (includes Narrative Risk Brief) */}
        <Suspense fallback={<OverviewLoading />}>
          <OverviewDataClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
