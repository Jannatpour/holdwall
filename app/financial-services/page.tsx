import { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { FinancialServicesDashboardClient } from "@/components/financial-services/dashboard-client";

export const metadata: Metadata = {
  title: "Financial Services | Holdwall POS",
  description: "Narrative Risk Early Warning for Financial Institutions - Banks, FinTech, Payments, Insurance",
};

export default async function FinancialServicesPage() {

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Financial Services</h1>
            <p className="text-muted-foreground">
              Narrative Risk Early Warning for Financial Institutions
            </p>
          </div>
        </div>
        
        <FinancialServicesDashboardClient />
      </div>
    </AppShell>
  );
}
