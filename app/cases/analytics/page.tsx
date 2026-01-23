/**
 * Case Analytics Dashboard
 * 
 * Main analytics page with links to executive, operational, and customer dashboards.
 */

import { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Users, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Case Analytics | Holdwall",
  description: "Analytics and insights for case management",
};

export default function CaseAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Case Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics and insights for case management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Executive Dashboard
            </CardTitle>
            <CardDescription>
              High-level KPIs and strategic metrics for leadership
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              View case volume trends, resolution times, customer satisfaction, cost per case, chargeback win rates, and regulatory compliance metrics.
            </p>
            <Button asChild>
              <Link href="/cases/analytics/executive">View Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Operational Dashboard
            </CardTitle>
            <CardDescription>
              Team performance and operational metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Monitor team performance, case assignment distribution, SLA compliance, escalation rates, and follow-up effectiveness.
            </p>
            <Button asChild>
              <Link href="/cases/analytics/operational">View Dashboard</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customer Dashboard
            </CardTitle>
            <CardDescription>
              Customer-facing metrics and satisfaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Track customer satisfaction trends, common issue categories, resolution time by type, and first-contact resolution rates.
            </p>
            <Button asChild>
              <Link href="/cases/analytics/customer">View Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
