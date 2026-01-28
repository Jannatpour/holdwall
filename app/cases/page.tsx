/**
 * Case Management Dashboard
 * 
 * Internal dashboard for viewing and managing cases.
 * Requires authentication.
 */

import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CasesList } from "@/components/cases-list";
import { AuthGuard } from "@/components/auth-guard";
import { Briefcase } from "@/components/demo-icons";

export const metadata: Metadata = {
  title: "Cases | Holdwall",
  description: "Manage and track financial services cases",
};

export default function CasesPage() {
  return (
    <AuthGuard requiredRole="USER">
      <AppShell>
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500/10 to-cyan-500/10 border border-teal-500/20">
                <Briefcase className="size-6 text-teal-600 dark:text-teal-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Case Management Intelligence
              </h1>
            </div>
            <p className="text-muted-foreground max-w-2xl">
              Comprehensive case management system for tracking and managing financial services cases with autonomous processing, evidence tracking, and workflow automation.
            </p>
          </div>

          <CasesList />
        </div>
      </AppShell>
    </AuthGuard>
  );
}
