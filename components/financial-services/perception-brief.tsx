"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface FinancialServicesBriefData {
  date: string;
  outbreakProbability: number;
  topClusters: Array<{
    id: string;
    primaryClaim: string;
    size: number;
    decisiveness: number;
    category: string;
    requiresEscalation: boolean;
    severity: "high" | "medium" | "low";
    routeTo: string[];
  }>;
  pendingLegalApprovals: number;
  artifacts: Array<{
    id: string;
    title: string;
    status: string;
    hasLegalApproval: boolean;
    createdAt: string;
  }>;
  recommendedActions: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    rationale: string;
    category?: string;
  }>;
  governanceLevel: string;
  legalApprovalRequired: boolean;
}

export function FinancialServicesPerceptionBrief() {
  const [data, setData] = React.useState<FinancialServicesBriefData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchBrief = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/financial-services/perception-brief");
        if (!response.ok) {
          throw new Error("Failed to fetch Financial Services perception brief");
        }
        const briefData = await response.json();
        if (!cancelled) {
          setData(briefData);
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

    fetchBrief();
    const interval = setInterval(fetchBrief, 3600000); // Refresh every hour

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Services Perception Brief</CardTitle>
          <CardDescription>Loading executive brief...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Services Perception Brief</CardTitle>
          <CardDescription>Daily executive brief</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || "Failed to load Financial Services perception brief"}
            </AlertDescription>
          </Alert>
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

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Services Perception Brief</CardTitle>
              <CardDescription>
                Daily executive brief for {format(new Date(data.date), "MMMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge variant="outline">
              <Shield className="mr-2 h-4 w-4" />
              {data.governanceLevel} Governance
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Outbreak Probability</div>
              <div className="text-2xl font-bold text-destructive">
                {data.outbreakProbability}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Active Clusters</div>
              <div className="text-2xl font-bold">{data.topClusters.length}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Pending Legal Approvals</div>
              <div className="text-2xl font-bold">{data.pendingLegalApprovals}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Published Artifacts</div>
              <div className="text-2xl font-bold">{data.artifacts.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Narrative Clusters */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Narrative Clusters</CardTitle>
          <CardDescription>
            Top narrative clusters categorized by financial services risk type
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {data.topClusters.map((cluster) => (
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
                    {cluster.requiresEscalation && (
                      <Badge variant={getSeverityBadgeVariant(cluster.severity)}>
                        {cluster.severity}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {cluster.routeTo.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {cluster.routeTo.join(", ")}
                      </div>
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
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
          <CardDescription>
            Prioritized actions based on current narrative risk and Financial Services governance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recommendedActions.map((action, idx) => (
              <Alert
                key={idx}
                variant={action.priority === "high" ? "destructive" : "default"}
              >
                <div className="flex items-start gap-3">
                  {action.priority === "high" ? (
                    <AlertTriangle className="size-4" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTitle>{action.action}</AlertTitle>
                      <Badge variant={getPriorityBadgeVariant(action.priority)}>
                        {action.priority}
                      </Badge>
                      {action.category && (
                        <Badge variant="outline">{action.category}</Badge>
                      )}
                    </div>
                    <AlertDescription>{action.rationale}</AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Legal Approval Status */}
      {data.pendingLegalApprovals > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Approval Status</CardTitle>
            <CardDescription>
              Artifacts awaiting legal review (required for Financial Services)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>{data.pendingLegalApprovals} Pending Approvals</AlertTitle>
              <AlertDescription>
                Financial Services operating mode requires legal approval before publishing any
                narrative response. Review pending approvals in the{" "}
                <Link href="/approvals" className="underline">
                  Approvals dashboard
                </Link>
                .
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
