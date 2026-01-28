/**
 * Metering Dashboard
 * View usage analytics and entitlements
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import {
  BarChart3,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from "@/components/demo-icons";

interface Entitlement {
  id: string;
  metric: string;
  soft_limit: number;
  hard_limit: number;
  enforcement: "SOFT" | "HARD" | "NONE";
  current_usage: number;
  counter?: {
    value: number;
    period: string;
    last_reset: string;
    next_reset: string;
  };
}

export default function MeteringPage() {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/governance/entitlements");
      if (!response.ok) {
        throw new Error("Failed to load metering data");
      }
      const data = await response.json();
      setEntitlements(data.entitlements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function getUsagePercentage(entitlement: Entitlement): number {
    const limit = entitlement.hard_limit || 1;
    const usage = entitlement.counter?.value || entitlement.current_usage || 0;
    return Math.min((usage / limit) * 100, 100);
  }

  function getUsageStatus(entitlement: Entitlement): "ok" | "warning" | "critical" {
    const percentage = getUsagePercentage(entitlement);
    if (percentage >= 100) return "critical";
    if (percentage >= 80) return "warning";
    return "ok";
  }

  const totalUsage = entitlements.reduce((sum, e) => sum + (e.counter?.value || e.current_usage), 0);
  const totalLimit = entitlements.reduce((sum, e) => sum + e.hard_limit, 0);
  const overallPercentage = totalLimit > 0 ? (totalUsage / totalLimit) * 100 : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Metering Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor usage analytics and entitlements across all metrics
            </p>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{entitlements.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Tracked metrics</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalUsage.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all metrics</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Limit</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalLimit.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Combined limits</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overall Usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{overallPercentage.toFixed(1)}%</div>
                <Progress value={overallPercentage} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Entitlements Table */}
        <Card>
          <CardHeader>
            <CardTitle>Entitlements & Usage</CardTitle>
            <CardDescription>
              Detailed breakdown of usage across all metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : entitlements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Enforcement</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Period</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entitlements.map((entitlement) => {
                    const percentage = getUsagePercentage(entitlement);
                    const status = getUsageStatus(entitlement);
                    return (
                      <TableRow key={entitlement.id}>
                        <TableCell>
                          <div className="font-medium">{entitlement.metric}</div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {entitlement.counter?.value.toLocaleString() || entitlement.current_usage.toLocaleString()}
                              </span>
                              {status === "warning" && (
                                <TrendingUp className="size-4 text-amber-600" />
                              )}
                              {status === "critical" && (
                                <TrendingDown className="size-4 text-red-600" />
                              )}
                            </div>
                            <Progress value={percentage} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>Soft: {entitlement.soft_limit.toLocaleString()}</div>
                            <div className="text-muted-foreground">
                              Hard: {entitlement.hard_limit.toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{entitlement.enforcement}</Badge>
                        </TableCell>
                        <TableCell>
                          {status === "ok" ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="size-3" />
                              OK
                            </Badge>
                          ) : status === "warning" ? (
                            <Badge variant="outline" className="gap-1 text-amber-600">
                              <AlertCircle className="size-3" />
                              Warning
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="size-3" />
                              Critical
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {entitlement.counter ? (
                            <div className="text-xs text-muted-foreground">
                              <div>{entitlement.counter.period}</div>
                              <div>Resets: {new Date(entitlement.counter.next_reset).toLocaleDateString()}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <BarChart3 className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No entitlements configured. Contact support to set up usage limits.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
