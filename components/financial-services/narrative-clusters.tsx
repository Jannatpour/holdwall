"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, AlertTriangle, Shield, BarChart3 } from "lucide-react";
import Link from "next/link";

interface NarrativeCluster {
  id: string;
  primaryClaim: string;
  size: number;
  decisiveness: number;
  category: string;
  requiresEscalation: boolean;
  severity: "high" | "medium" | "low";
  routeTo: string[];
}

export function FinancialServicesNarrativeClusters() {
  const [clusters, setClusters] = React.useState<NarrativeCluster[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchClusters = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/financial-services/perception-brief");
        if (!response.ok) {
          throw new Error("Failed to fetch narrative clusters");
        }
        const data = await response.json();
        if (!cancelled) {
          setClusters(data.topClusters || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchClusters();
    const interval = setInterval(fetchClusters, 60000); // Refresh every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Financial Narrative Intelligence
          </CardTitle>
          <CardDescription className="text-base">Analyzing narrative clusters...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Financial Narrative Intelligence
          </CardTitle>
          <CardDescription className="text-base">Error loading narrative clusters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <BarChart3 className="h-5 w-5 text-primary" />
          Financial Narrative Intelligence
        </CardTitle>
        <CardDescription className="text-base">
          Critical narrative clusters categorized by financial services risk type with automated escalation routing and severity assessment
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clusters.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No narrative clusters found. Connect data sources to start monitoring.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Primary Claim</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead>Decisiveness</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Route To</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clusters.map((cluster) => (
                <TableRow key={cluster.id}>
                  <TableCell>
                    <Badge variant="outline">{cluster.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium max-w-md">
                    {cluster.primaryClaim}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{cluster.size}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={cluster.decisiveness * 100} className="w-20" />
                      <span className="text-sm text-muted-foreground">
                        {Math.round(cluster.decisiveness * 100)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {cluster.requiresEscalation ? (
                      <div className="flex items-center gap-2">
                        <Badge variant={getSeverityBadgeVariant(cluster.severity)}>
                          {cluster.severity}
                        </Badge>
                        <AlertTriangle className="size-4 text-destructive" />
                      </div>
                    ) : (
                      <Badge variant="secondary">Low</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {cluster.routeTo.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <Shield className="size-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {cluster.routeTo.join(", ")}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/claims?cluster=${cluster.id}`}>
                        View <ExternalLink className="ml-1 size-3" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
