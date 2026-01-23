import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { POSDashboardClient } from "@/components/pos-dashboard-client";
import { Brain, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Perception Operating System | Holdwall POS",
  description: "Complete POS dashboard for belief graph engineering, consensus hijacking, AI authority, narrative preemption, trust substitution, and decision funnel domination.",
};

export default async function POSPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                <Brain className="size-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Perception Operating System
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Advanced cognitive and algorithmic dominance system that makes negative content structurally irrelevant through belief graph engineering, consensus hijacking, AI authority, narrative preemption, trust substitution, and decision funnel domination.
            </p>
          </div>
        </div>
        
        <POSDashboardClient />
      </div>
    </AppShell>
  );
}
