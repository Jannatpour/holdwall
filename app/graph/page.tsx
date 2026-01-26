import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Network, Search, Sliders, RefreshCw, Sparkles, ArrowRight } from "lucide-react";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { GraphCanvas } from "@/components/graph-canvas";
import { GraphDataClient } from "@/components/graph-data-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { GraphLoading } from "@/components/ui/loading-states";

export const metadata: Metadata = genMeta(
  "Belief Graph",
  "Explore reinforcement and neutralization paths in the belief graph. Model narrative dynamics with time-decay and actor-weighted belief modeling.",
  "/graph"
);

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; timestamp?: string; node_id?: string }>;
}) {
  const params = await searchParams;
  
  return (
    <AppShell>
      <GuideWalkthrough pageId="graph" />
      <div className="space-y-6">
        <div className="flex items-start justify-between" data-guide="graph-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20">
                <Network className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Belief Graph Intelligence
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Advanced graph visualization for exploring belief propagation, reinforcement/neutralization pathways, and time-weighted narrative dynamics. Model complex narrative relationships with precision.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-guide="recompute" className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <RefreshCw className="mr-2 size-4" />
              Recompute
            </Button>
            <GuideButton pageId="graph" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Graph Canvas */}
          <div className="space-y-4">
            {/* Controls */}
            <Card className="transition-all duration-200 hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sliders className="size-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Graph Controls</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select defaultValue={params.range || "30d"}>
                    <SelectTrigger data-guide="time-range">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 Days</SelectItem>
                      <SelectItem value="30d">Last 30 Days</SelectItem>
                      <SelectItem value="90d">Last 90 Days</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Node Types</Label>
                  <div className="flex flex-wrap gap-2" data-guide="node-filters">
                    <Label className="flex items-center gap-2">
                      <Switch defaultChecked />
                      <span className="text-sm">Claims</span>
                    </Label>
                    <Label className="flex items-center gap-2">
                      <Switch defaultChecked />
                      <span className="text-sm">Emotions</span>
                    </Label>
                    <Label className="flex items-center gap-2">
                      <Switch defaultChecked />
                      <span className="text-sm">Proof Points</span>
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Graph Data with Canvas */}
            <div data-guide="graph-canvas">
              <Suspense fallback={<GraphLoading />}>
                <GraphDataClient range={params.range} timestamp={params.timestamp} nodeId={params.node_id} />
              </Suspense>
            </div>
          </div>

          {/* Inspector Panel */}
          <Card data-guide="inspector-panel" className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <CardTitle className="font-semibold">Graph Inspector</CardTitle>
              </div>
              <CardDescription>Select a node or edge to view detailed information and relationships</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground text-center py-8" data-guide="edge-details">
                Select a node or edge to view details
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
