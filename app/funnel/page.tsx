import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Funnel } from "lucide-react";
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
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Decision Funnel Domination</h1>
          <p className="text-muted-foreground">
            Map assets to decision checkpoints per persona and simulate what buyer sees
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
          {/* Funnel Stages */}
          <Card>
            <CardHeader>
              <CardTitle>Funnel Stages</CardTitle>
              <CardDescription>
                Awareness → Research → Comparison → Decision → Post-purchase
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
