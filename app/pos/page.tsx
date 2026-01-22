import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { POSDashboardClient } from "@/components/pos-dashboard-client";

export const metadata: Metadata = {
  title: "Perception Operating System | Holdwall POS",
  description: "Complete POS dashboard for belief graph engineering, consensus hijacking, AI authority, narrative preemption, trust substitution, and decision funnel domination.",
};

export default async function POSPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Perception Operating System</h1>
            <p className="text-muted-foreground">
              Cognitive + algorithmic dominance system that makes negative content structurally irrelevant
            </p>
          </div>
        </div>
        
        <POSDashboardClient />
      </div>
    </AppShell>
  );
}
