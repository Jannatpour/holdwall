import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter } from "lucide-react";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { SignalsDataClient } from "@/components/signals-data-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";

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
        <div className="flex items-center justify-between" data-guide="signals-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Signals</h1>
            <p className="text-muted-foreground">
              Streaming feed of ingested signals with evidence preview
            </p>
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
            <SignalsDataClient tabFilter="all" />
          </TabsContent>
          <TabsContent value="high-risk" className="space-y-4">
            <SignalsDataClient tabFilter="high-risk" />
          </TabsContent>
          <TabsContent value="unclustered" className="space-y-4">
            <SignalsDataClient tabFilter="unclustered" />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
