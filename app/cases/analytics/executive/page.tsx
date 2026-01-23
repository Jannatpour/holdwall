/**
 * Executive Analytics Dashboard
 * 
 * High-level KPIs and strategic metrics for leadership.
 */

import { Metadata } from "next";
import { ExecutiveDashboard } from "@/components/cases/analytics/executive-dashboard";

export const metadata: Metadata = {
  title: "Executive Analytics | Holdwall",
  description: "Executive dashboard for case management",
};

export default function ExecutiveAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Executive Dashboard</h1>
        <p className="text-muted-foreground">
          High-level KPIs and strategic metrics
        </p>
      </div>

      <ExecutiveDashboard />
    </div>
  );
}
