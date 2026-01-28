import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Funnel, Sparkles, Target, ArrowRight } from "@/components/demo-icons";
import { generateMetadata as genMeta } from "@/lib/seo/metadata";
import { FunnelSimulatorClient } from "@/components/funnel-simulator-client";

export const metadata: Metadata = genMeta(
  "Funnel Map",
  "Decision checkpoint controls and measurements. Control every decision checkpoint: Awareness → Research → Comparison → Decision → Post-purchase.",
  "/funnel"
);

export default async function FunnelPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string; brand_id?: string }>;
}) {
  const params = await searchParams;
  
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500/10 to-rose-500/10 border border-pink-500/20">
              <Funnel className="size-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
              Decision Funnel Intelligence
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Strategic decision checkpoint control and measurement system. Map trust assets to decision checkpoints per persona and simulate what buyers see at each stage: Awareness → Research → Comparison → Decision → Post-purchase.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Funnel Stages */}
          <Card className="transition-all duration-200 hover:shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="size-5 text-primary" />
                <CardTitle className="font-semibold">Funnel Stages</CardTitle>
              </div>
              <CardDescription>
                Strategic decision checkpoints: Awareness → Research → Comparison → Decision → Post-purchase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                {["Awareness", "Research", "Comparison", "Decision", "Post-purchase"].map((stage, idx) => (
                  <div key={stage} className="space-y-2">
                    <div className="text-sm font-medium text-center">{stage}</div>
                    <div className="h-32 rounded-lg border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">
                      Drop zone
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Simulator Panel */}
          <FunnelSimulatorClient persona={params.persona} />
        </div>
      </div>
    </AppShell>
  );
}
