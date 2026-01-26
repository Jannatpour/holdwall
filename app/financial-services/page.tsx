import { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { FinancialServicesDashboardClient } from "@/components/financial-services/dashboard-client";
import { Building2 } from "lucide-react";
import { DashboardLoading } from "@/components/ui/loading-states";

export const metadata: Metadata = {
  title: "Financial Services | Holdwall POS",
  description: "Narrative Risk Early Warning for Financial Institutions - Banks, FinTech, Payments, Insurance",
};

export default async function FinancialServicesPage() {

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between border-b pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  Financial Services Command Center
                </h1>
                <p className="text-base text-muted-foreground mt-2 leading-6">
                  Transform narrative risk into measurable, governable operational advantage. 
                  Built for banks, FinTech, payments, and insurance organizations requiring 
                  financial-grade governance and regulatory compliance.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <Suspense fallback={<DashboardLoading />}>
          <FinancialServicesDashboardClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
