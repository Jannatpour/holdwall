/**
 * Operational Analytics Dashboard
 * 
 * Team performance and operational metrics.
 */

import { Metadata } from "next";
import { OperationalDashboard } from "@/components/cases/analytics/operational-dashboard";

export const metadata: Metadata = {
  title: "Operational Analytics | Holdwall",
  description: "Operational dashboard for case management",
};

export default function OperationalAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Operational Dashboard</h1>
        <p className="text-muted-foreground">
          Team performance and operational metrics
        </p>
      </div>

      <OperationalDashboard />
    </div>
  );
}
