/**
 * Customer Analytics Dashboard
 * 
 * Customer-facing metrics and satisfaction.
 */

import { Metadata } from "next";
import { CustomerDashboard } from "@/components/cases/analytics/customer-dashboard";

export const metadata: Metadata = {
  title: "Customer Analytics | Holdwall",
  description: "Customer dashboard for case management",
};

export default function CustomerAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Customer Dashboard</h1>
        <p className="text-muted-foreground">
          Customer satisfaction and experience metrics
        </p>
      </div>

      <CustomerDashboard />
    </div>
  );
}
