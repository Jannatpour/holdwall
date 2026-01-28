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
import { FileText, Network, CheckCircle2, TrendingUp, AlertTriangle, Clock, ArrowRight, Shield, Target, Zap, Sparkles, BarChart3, Settings, Bell, RefreshCw, Lightbulb, Rocket, TrendingDown, Activity } from "@/components/demo-icons";
import { Skeleton } from "@/components/ui/skeleton";
import { NarrativeRiskBrief } from "@/components/narrative-risk-brief";
import { ExplainScoreDrawer } from "@/components/explain-score-drawer";
import { RealtimeOpsFeed } from "@/components/realtime-ops-feed";
import { EmptyState, ErrorState } from "@/components/ui/loading-states";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

// Security Incidents Widget Component
function SecurityIncidentsWidget() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchIncidents() {
      try {
        const res = await fetch("/api/security-incidents?limit=5&status=OPEN");
        if (res.ok) {
          const data = await res.json();
          setIncidents(data.incidents || []);
        }
      } catch (err) {
        // Silently fail - widget is optional
      } finally {
        setLoading(false);
      }
    }
    fetchIncidents();
  }, []);

  if (loading) {
    return <Skeleton className="h-24" />;
  }

  if (incidents.length === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground text-center py-2">
          No open security incidents
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/security-incidents">
            View All Incidents
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {incidents.slice(0, 3).map((incident) => (
        <div key={incident.id} className="flex items-center justify-between p-2 rounded border hover:bg-accent transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium truncate">{incident.title}</span>
              {incident.narrativeRiskScore && incident.narrativeRiskScore >= 0.7 && (
                <Badge variant="destructive" className="text-xs">High Risk</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {incident.outbreakProbability && (
                <span>Outbreak: {(incident.outbreakProbability * 100).toFixed(0)}%</span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/security-incidents/${incident.id}`}>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ))}
      {incidents.length > 3 && (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/security-incidents">
            View {incidents.length - 3} more
          </Link>
        </Button>
      )}
    </div>
  );
}

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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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
    
    // Auto-refresh every 30 seconds if enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData();
        setLastRefresh(new Date());
      }, 30000);
    }
    
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [timeRange, autoRefresh]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + R: Refresh data
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        setLoading(true);
        setError(null);
      }
      // Ctrl/Cmd + Shift + R: Toggle auto-refresh
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        setAutoRefresh(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

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
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between">
        <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as "today" | "7d" | "30d")}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="7d">7 Days</TabsTrigger>
            <TabsTrigger value="30d">30 Days</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                }}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh data (Ctrl/Cmd + R)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className="gap-2"
              >
                <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
                Auto
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Auto-refresh every 30s (Ctrl/Cmd + Shift + R)</p>
            </TooltipContent>
          </Tooltip>
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
      
      {/* Quick Actions Panel */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/signals">
                <BarChart3 className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">View Signals</div>
                  <div className="text-xs text-muted-foreground">Monitor incoming data</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/claims">
                <FileText className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Claim Clusters</div>
                  <div className="text-xs text-muted-foreground">Review narratives</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/studio">
                <Sparkles className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Create Artifact</div>
                  <div className="text-xs text-muted-foreground">AAAL Studio</div>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link href="/forecasts">
                <TrendingUp className="mr-2 h-4 w-4" />
                <div className="text-left">
                  <div className="font-medium">Forecasts</div>
                  <div className="text-xs text-muted-foreground">Outbreak probability</div>
                </div>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              if (rec.cluster_id) {
                                router.push(`/claims/${rec.cluster_id}`);
                              } else if (rec.forecast_id) {
                                router.push(`/forecasts?forecast=${rec.forecast_id}`);
                              }
                            }}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Execute action</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

      {/* Bottom Row: Ops Feed + Security Incidents + Approvals */}
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

        {/* Security Incidents (SKU D) */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Security Incidents
                </CardTitle>
                <CardDescription>SKU D: Narrative Management</CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">New</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <SecurityIncidentsWidget />
          </CardContent>
        </Card>
      </div>
      
      {/* Second Bottom Row: Approvals + Quick Links */}
      <div className="grid gap-6 lg:grid-cols-3">
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
        
        {/* Security Incidents Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Security Quick Actions
            </CardTitle>
            <CardDescription>SKU D features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/security-incidents">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  View All Incidents
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/solutions/security-incidents">
                  <FileText className="mr-2 h-4 w-4" />
                  Learn About SKU D
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/integrations">
                  <Network className="mr-2 h-4 w-4" />
                  Configure Webhooks
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* New Features Quick Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              New Features
            </CardTitle>
            <CardDescription>January 2026 updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/signals">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Signals Analytics
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/cases">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Case Management
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link href="/pos">
                  <Network className="mr-2 h-4 w-4" />
                  POS Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
