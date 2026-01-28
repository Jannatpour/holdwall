/**
 * Customer Dashboard Component
 * 
 * Customer-facing metrics and satisfaction.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";
import { Star, Clock, CheckCircle2, TrendingUp } from "@/components/demo-icons";

interface CustomerMetrics {
  customerSatisfaction: number;
  satisfactionTrend: Array<{ date: string; score: number }>;
  commonIssueCategories: Array<{ category: string; count: number }>;
  resolutionTimeByType: Record<string, number>;
  firstContactResolutionRate: number;
  casesResolved: number;
  averageResolutionTime: number;
}

export function CustomerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CustomerMetrics | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/cases/analytics/customer");
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingState count={4} />;
  }

  if (error || !metrics) {
    return <ErrorState error={error || "Failed to load metrics"} title="Failed to load customer metrics" />;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.customerSatisfaction.toFixed(1)}/5.0</div>
            <p className="text-xs text-muted-foreground">
              Based on customer feedback
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">First Contact Resolution</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.firstContactResolutionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Resolved on first contact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageResolutionTime.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Average time to resolution
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases Resolved</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.casesResolved.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Total resolved cases
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Common Issue Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Common Issue Categories</CardTitle>
          <CardDescription>Most frequently reported issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {metrics.commonIssueCategories.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-sm">{item.category}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resolution Time by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Time by Case Type</CardTitle>
          <CardDescription>Average resolution time for each case type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.resolutionTimeByType).map(([type, hours]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm">{type.replace(/_/g, " ")}</span>
                <span className="font-medium">{hours.toFixed(1)} hours</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
