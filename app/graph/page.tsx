import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Network, Search, Sliders, RefreshCw } from "lucide-react";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { GraphCanvas } from "@/components/graph-canvas";
import { GraphDataClient } from "@/components/graph-data-client";
import { GuideButton, GuideWalkthrough } from "@/components/guides";

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
        <div className="flex items-center justify-between" data-guide="graph-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Belief Graph Explorer</h1>
            <p className="text-muted-foreground">
              Interactive graph to explore belief propagation, reinforcement/neutralization, and time weights
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-guide="recompute">
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
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Controls</CardTitle>
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
              <GraphDataClient range={params.range} timestamp={params.timestamp} nodeId={params.node_id} />
            </div>
          </div>

          {/* Inspector Panel */}
          <Card data-guide="inspector-panel">
            <CardHeader>
              <CardTitle>Inspector</CardTitle>
              <CardDescription>Selected node/edge details</CardDescription>
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
