import { Metadata } from "next";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play, BarChart3, TrendingUp } from "@/components/demo-icons";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { GuideButton, GuideWalkthrough } from "@/components/guides";
import { ForecastsLoading } from "@/components/ui/loading-states";

const ForecastsData = dynamic(() => import("@/components/forecasts-data").then((mod) => ({ default: mod.ForecastsData })), {
  loading: () => <ForecastsLoading />,
  ssr: true,
});

export const metadata: Metadata = genMeta(
  "Forecasts",
  "Diffusion, drift dashboards, and what-if simulations powered by Graph Neural Networks. Outbreak probability forecasting with AI-powered insights.",
  "/forecasts"
);

export default function ForecastsPage() {
  return (
    <AppShell>
      <GuideWalkthrough pageId="forecasts" />
      <div className="space-y-6">
        <div className="flex items-start justify-between border-b pb-6" data-guide="forecasts-header">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <TrendingUp className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Predictive Narrative Intelligence
                </h1>
                <p className="text-base text-muted-foreground mt-2 leading-6">
                  Advanced outbreak probability forecasting, sentiment drift analysis, and what-if scenario 
                  simulations powered by 7 Graph Neural Network models. Predict narrative trajectories before they escalate.
                </p>
              </div>
            </div>
          </div>
          <GuideButton pageId="forecasts" />
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList data-guide="forecasts-tabs">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="drift">Sentiment Drift</TabsTrigger>
            <TabsTrigger value="outbreak">Outbreak Probability</TabsTrigger>
            <TabsTrigger value="simulation">What-If Simulations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Suspense fallback={<ForecastsLoading />}>
              <ForecastsData />
            </Suspense>
          </TabsContent>

          <TabsContent value="drift" className="space-y-4">
            <Suspense fallback={<ForecastsLoading />}>
              <ForecastsData />
            </Suspense>
          </TabsContent>

          <TabsContent value="outbreak" className="space-y-4">
            <Suspense fallback={<ForecastsLoading />}>
              <ForecastsData />
            </Suspense>
          </TabsContent>

          <TabsContent value="simulation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>What-If Simulation</CardTitle>
                <CardDescription>
                  Simulate scenarios using Graph Neural Networks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="scenario">Scenario Description</Label>
                  <Input
                    id="scenario"
                    data-guide="scenario-input"
                    placeholder="e.g., What if we publish a response artifact addressing the top cluster?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeframe">Time Horizon (days)</Label>
                  <Input id="timeframe" data-guide="time-horizon" type="number" defaultValue={7} min={1} max={30} />
                </div>
                <Button className="w-full" data-guide="run-simulation">
                  <Play className="mr-2 size-4" />
                  Run Simulation
                </Button>
                <div className="rounded-lg border bg-muted/20 p-8 text-center">
                  <BarChart3 className="mx-auto size-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Run a simulation to see predicted outcomes
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
