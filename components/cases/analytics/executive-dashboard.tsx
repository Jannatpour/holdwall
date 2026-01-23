/**
 * Executive Dashboard Component
 * 
 * High-level KPIs and strategic metrics for leadership.
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingState, ErrorState } from "@/components/ui/loading-states";
import { TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

interface ExecutiveMetrics {
  totalCases: number;
  casesThisMonth: number;
  casesLastMonth: number;
  averageResolutionTime: number;
  averageResolutionTimeChange: number;
  slaCompliance: number;
  slaComplianceChange: number;
  chargebackWinRate: number;
  chargebackWinRateChange: number;
  costPerCase: number;
  costPerCaseChange: number;
  customerSatisfaction: number;
  customerSatisfactionChange: number;
  regulatoryFlags: number;
  casesByType: Record<string, number>;
  casesByStatus: Record<string, number>;
  resolutionTimeTrend: Array<{ date: string; hours: number }>;
  volumeTrend: Array<{ date: string; count: number }>;
}

export function ExecutiveDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<ExecutiveMetrics | null>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/cases/analytics/executive");
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
    return <LoadingState count={6} />;
  }

  if (error || !metrics) {
    return <ErrorState error={error || "Failed to load metrics"} title="Failed to load executive metrics" />;
  }

  const formatChange = (value: number) => {
    const isPositive = value >= 0;
    return (
      <span className={isPositive ? "text-green-600" : "text-red-600"}>
        {isPositive ? <TrendingUp className="inline h-4 w-4" /> : <TrendingDown className="inline h-4 w-4" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCases.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.casesThisMonth} this month
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
              {formatChange(metrics.averageResolutionTimeChange)} vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.slaCompliance.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(metrics.slaComplianceChange)} vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chargeback Win Rate</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.chargebackWinRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(metrics.chargebackWinRateChange)} vs last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cost Per Case</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${metrics.costPerCase.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(metrics.costPerCaseChange)} vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Customer Satisfaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.customerSatisfaction.toFixed(1)}/5.0</div>
            <p className="text-xs text-muted-foreground">
              {formatChange(metrics.customerSatisfactionChange)} vs last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Regulatory Flags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.regulatoryFlags}</div>
            <p className="text-xs text-muted-foreground">
              Cases requiring regulatory attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cases by Type */}
      <Card>
        <CardHeader>
          <CardTitle>Cases by Type</CardTitle>
          <CardDescription>Distribution of case types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.casesByType).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm">{type.replace(/_/g, " ")}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cases by Status */}
      <Card>
        <CardHeader>
          <CardTitle>Cases by Status</CardTitle>
          <CardDescription>Current case status distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(metrics.casesByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm">{status.replace(/_/g, " ")}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
