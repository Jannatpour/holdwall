import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Radio } from "@/components/demo-icons";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { SignalsDataClient } from "@/components/signals-data-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { SignalsLoading } from "@/components/ui/loading-states";

export const metadata: Metadata = genMeta(
  "Signals",
  "Streaming feed of ingested signals with evidence preview. Monitor narrative signals across all channels with AI-powered analysis.",
  "/signals"
);

export default function SignalsPage() {
  return (
    <AppShell>
      <GuideWalkthrough pageId="signals" />
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b pb-6" data-guide="signals-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Radio className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Signal Intelligence Hub
                </h1>
                <p className="text-base text-muted-foreground mt-2 leading-6">
                  Real-time streaming feed of ingested signals with advanced analytics, AI-powered insights, 
                  and comprehensive evidence preview. Monitor narrative signals across all channels with 
                  bulk operations and trend visualization.
                </p>
              </div>
            </div>
          </div>
          <GuideButton pageId="signals" />
        </div>

        {/* Filters are now handled inside SignalsData component */}

        {/* Signals Feed */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Signals</TabsTrigger>
            <TabsTrigger value="high-risk">High Risk</TabsTrigger>
            <TabsTrigger value="unclustered">Unclustered</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="space-y-4">
            <Suspense fallback={<SignalsLoading />}>
              <SignalsDataClient tabFilter="all" />
            </Suspense>
          </TabsContent>
          <TabsContent value="high-risk" className="space-y-4">
            <Suspense fallback={<SignalsLoading />}>
              <SignalsDataClient tabFilter="high-risk" />
            </Suspense>
          </TabsContent>
          <TabsContent value="unclustered" className="space-y-4">
            <Suspense fallback={<SignalsLoading />}>
              <SignalsDataClient tabFilter="unclustered" />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
