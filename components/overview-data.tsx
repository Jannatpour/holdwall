"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Network, CheckCircle2, TrendingUp, AlertTriangle, Clock, ArrowRight, Shield, Target, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { NarrativeRiskBrief } from "@/components/narrative-risk-brief";
import { ExplainScoreDrawer } from "@/components/explain-score-drawer";
import { RealtimeOpsFeed } from "@/components/realtime-ops-feed";
import { EmptyState, ErrorState } from "@/components/ui/loading-states";
import Link from "next/link";

interface OverviewData {
  kpis: {
    perception_health_score: number;
    outbreak_probability_7d: number;
    ai_citation_coverage: number;
    trust_coverage_ratio: number;
  };
  top_clusters: Array<{
    cluster_id: string;
    primary_claim: {
      claim_id: string;
      canonical_text: string;
      decisiveness: number;
    };
    size: number;
    decisiveness: number;
  }>;
  recommendations: Array<{
    id: string;
    priority: "high" | "medium" | "low";
    action: string;
    rationale: string;
    cluster_id?: string;
    forecast_id?: string;
  }>;
  approvals_pending: number;
}

export function OverviewData() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d">("7d");

  // Redirect to sign-in if not authenticated
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin?callbackUrl=/overview");
    }
  }, [status, router]);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [metricsRes, clustersRes, recommendationsRes, approvalsRes] = await Promise.all([
          fetch(`/api/metrics/summary?range=${timeRange}`),
          fetch(`/api/claim-clusters/top?sort=decisiveness&range=${timeRange}&limit=10`),
          fetch("/api/recommendations?limit=10"),
          fetch("/api/approvals?status=pending&count=true"),
        ]);

        // Handle 401 (Unauthorized) - redirect to sign in
        if (metricsRes.status === 401 || clustersRes.status === 401 || recommendationsRes.status === 401) {
          window.location.href = "/auth/signin?callbackUrl=/overview";
          return;
        }

        // Handle other errors
        if (!metricsRes.ok || !clustersRes.ok || !recommendationsRes.ok) {
          throw new Error("Failed to fetch overview data");
        }

        const [kpis, clusters, recommendations, approvals] = await Promise.all([
          metricsRes.json(),
          clustersRes.json(),
          recommendationsRes.json(),
          approvalsRes.ok ? approvalsRes.json() : { count: 0 },
        ]);

        if (!cancelled) {
          setData({
            kpis: {
              perception_health_score: kpis.perception_health_score || 0,
              outbreak_probability_7d: kpis.outbreak_probability_7d || 0,
              ai_citation_coverage: kpis.ai_citation_coverage || 0,
              trust_coverage_ratio: kpis.trust_coverage_ratio || 0,
            },
            top_clusters: clusters.clusters || [],
            recommendations: recommendations.recommendations || [],
            approvals_pending: approvals.count || 0,
          });
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
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        {/* Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
        }}
        title="Failed to load overview"
        description="Unable to fetch overview data. Please try again."
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="No data available"
        description="Connect sources to start seeing insights"
        action={{
          label: "Go to Signals",
          onClick: () => window.location.href = "/signals",
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Tabs */}
      <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as "today" | "7d" | "30d")}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top Row: 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Perception Health Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Perception Health Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.kpis.perception_health_score * 100)}%</div>
            <Progress value={data.kpis.perception_health_score * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              Based on sentiment, decisiveness, and trust coverage
            </p>
          </CardContent>
        </Card>

        {/* Outbreak Probability */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outbreak Probability</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {Math.round(data.kpis.outbreak_probability_7d * 100)}%
            </div>
            <Progress value={data.kpis.outbreak_probability_7d * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">7-day forecast</p>
          </CardContent>
        </Card>

        {/* AI Citation Coverage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Citation Coverage</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.kpis.ai_citation_coverage * 100)}%</div>
            <Progress value={data.kpis.ai_citation_coverage * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Answers with citations</p>
          </CardContent>
        </Card>

        {/* Trust Coverage Ratio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trust Coverage Ratio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(data.kpis.trust_coverage_ratio * 100)}%</div>
            <Progress value={data.kpis.trust_coverage_ratio * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">Clusters with trust assets</p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Top Clusters + Recommended Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Claim Clusters */}
        <Card>
          <CardHeader>
            <CardTitle>Top Claim Clusters</CardTitle>
            <CardDescription>Ranked by decisiveness</CardDescription>
          </CardHeader>
          <CardContent>
            {data.top_clusters.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Claim</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Decisiveness</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.top_clusters.map((cluster) => (
                    <TableRow key={cluster.cluster_id}>
                      <TableCell className="font-medium max-w-md">
                        {cluster.primary_claim.canonical_text.substring(0, 100)}
                        {cluster.primary_claim.canonical_text.length > 100 && "..."}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cluster.size}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={cluster.decisiveness * 100} className="w-20" />
                          <span className="text-sm">{Math.round(cluster.decisiveness * 100)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/claims/${cluster.cluster_id}`}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No clusters"
                description="No claim clusters found for this period"
                action={{
                  label: "View Signals",
                  onClick: () => window.location.href = "/signals",
                }}
              />
            )}
          </CardContent>
        </Card>

        {/* Recommended Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Recommended Actions</CardTitle>
            <CardDescription>POS Autopilot queue</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recommendations.length > 0 ? (
              <div className="space-y-3">
                {data.recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex items-start justify-between rounded-lg border p-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={
                            rec.priority === "high" ? "destructive" :
                            rec.priority === "medium" ? "secondary" : "outline"
                          }
                        >
                          {rec.priority}
                        </Badge>
                        <span className="font-medium text-sm">{rec.action}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.rationale}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Zap className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No recommendations"
                description="All systems operating normally"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Ops Feed + Active Incidents + Approvals */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Ops Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Ops Feed</CardTitle>
            <CardDescription>Real-time operational events</CardDescription>
          </CardHeader>
          <CardContent>
            <RealtimeOpsFeed maxEvents={20} />
          </CardContent>
        </Card>

        {/* Approvals Pending */}
        <Card>
          <CardHeader>
            <CardTitle>Approvals Pending</CardTitle>
            <CardDescription>{data.approvals_pending} items</CardDescription>
          </CardHeader>
          <CardContent>
            {data.approvals_pending > 0 ? (
              <div className="space-y-3">
                <div className="text-2xl font-bold">{data.approvals_pending}</div>
                <Button asChild className="w-full">
                  <Link href="/governance">Review Approvals</Link>
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No pending approvals
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
