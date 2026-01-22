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
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  BarChart3,
  FileText,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface ClaimCluster {
  cluster_id: string;
  primary_claim: string;
  claim_count: number;
  decisiveness: number;
  trend: "up" | "down" | "stable";
  evidence_count: number;
}

interface OutbreakForecast {
  metric: string;
  probability: number;
  horizon_days: number;
  confidence: number;
  current_value: number;
  forecasted_value: number;
}

interface RecommendedAction {
  id: string;
  type: "monitor" | "respond" | "publish" | "escalate";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  cluster_id?: string;
  artifact_id?: string;
}

interface NarrativeRiskBriefData {
  date: string;
  outbreakProbability: number;
  topClusters: Array<{
    id: string;
    primaryClaim: string;
    size: number;
    decisiveness: number;
  }>;
  aiCitationCoverage: number;
  activeIncidents: number;
  recommendedActions: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    rationale: string;
  }>;
}

export function NarrativeRiskBrief() {
  const [data, setData] = React.useState<NarrativeRiskBriefData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchBrief = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/narrative-risk-brief");
        if (!response.ok) {
          throw new Error("Failed to fetch narrative risk brief");
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
    // Auto-refresh every hour
    const interval = setInterval(fetchBrief, 3600000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Narrative Risk Brief</CardTitle>
          <CardDescription>Loading daily executive brief...</CardDescription>
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
          <CardTitle>Narrative Risk Brief</CardTitle>
          <CardDescription>Daily executive brief</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || "Failed to load narrative risk brief"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="size-4 text-destructive" />;
      case "down":
        return <TrendingDown className="size-4 text-green-600" />;
      default:
        return <BarChart3 className="size-4 text-muted-foreground" />;
    }
  };

  const getActionBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      default:
        return "secondary";
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "monitor":
        return <Clock className="size-4" />;
      case "respond":
        return <AlertTriangle className="size-4" />;
      case "publish":
        return <FileText className="size-4" />;
      case "escalate":
        return <TrendingUp className="size-4" />;
      default:
        return <CheckCircle2 className="size-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Narrative Risk Brief</CardTitle>
              <CardDescription>
                Daily executive brief for {format(new Date(data.date), "MMMM d, yyyy")}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/forecasts">
                View Full Forecasts <ExternalLink className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Top Clusters</div>
              <div className="text-2xl font-bold">{data.topClusters.length}</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Outbreak Probability</div>
              <div className="text-2xl font-bold text-destructive">
                {data.outbreakProbability}%
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">AI Citation Coverage</div>
              <div className="text-2xl font-bold">{data.aiCitationCoverage}%</div>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Active Incidents</div>
              <div className="text-2xl font-bold">{data.activeIncidents}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Claim Clusters */}
      <Card>
        <CardHeader>
          <CardTitle>Top Claim Clusters</CardTitle>
          <CardDescription>
            Most significant narrative clusters requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Primary Claim</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead>Decisiveness</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topClusters.map((cluster) => (
                <TableRow key={cluster.id}>
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
                    <Badge variant="secondary">-</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <BarChart3 className="size-4 text-muted-foreground" />
                    </div>
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

      {/* Outbreak Probability */}
      <Card>
        <CardHeader>
          <CardTitle>Outbreak Risk</CardTitle>
          <CardDescription>
            Current narrative outbreak probability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  <span className="font-medium">Overall Outbreak Probability</span>
                </div>
                <div className="text-2xl font-bold text-destructive">
                  {data.outbreakProbability}%
                </div>
              </div>
              <Progress value={data.outbreakProbability} className="h-3" />
              <div className="text-sm text-muted-foreground">
                Based on recent signal analysis and forecast models
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Actions</CardTitle>
          <CardDescription>
            Prioritized actions based on current narrative risk
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recommendedActions.map((action, idx) => (
              <Alert key={idx} variant={action.priority === "high" ? "destructive" : "default"}>
                <div className="flex items-start gap-3">
                  {getActionTypeIcon("respond")}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTitle>{action.action}</AlertTitle>
                      <Badge variant={getActionBadgeVariant(action.priority)}>
                        {action.priority}
                      </Badge>
                    </div>
                    <AlertDescription>{action.rationale}</AlertDescription>
                  </div>
                </div>
              </Alert>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
