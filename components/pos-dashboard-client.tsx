"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain,
  TrendingUp,
  Shield,
  Target,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  BarChart3,
  Network,
  FileText,
  Users,
  Zap,
} from "lucide-react";

interface POSMetrics {
  bge: {
    weakNodesCount: number;
    averageIrrelevance: number;
  };
  consensus: {
    totalSignals: number;
    consensusStrength: number;
  };
  aaal: {
    citationScore: number;
    publishedContent: number;
  };
  npe: {
    activePredictions: number;
    preemptiveActions: number;
  };
  tsm: {
    trustScore: number;
    validatorCount: number;
  };
  dfd: {
    overallControl: number;
    stageCoverage: number;
  };
  overall: {
    posScore: number;
  };
}

interface Recommendation {
  priority: "high" | "medium" | "low";
  action: string;
  rationale: string;
}

export function POSDashboardClient() {
  const [metrics, setMetrics] = useState<POSMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, recommendationsRes] = await Promise.all([
        fetch("/api/pos/orchestrator?action=metrics"),
        fetch("/api/pos/orchestrator?action=recommendations"),
      ]);

      if (!metricsRes.ok || !recommendationsRes.ok) {
        throw new Error("Failed to load POS data");
      }

      const metricsData = await metricsRes.json();
      const recommendationsData = await recommendationsRes.json();

      setMetrics(metricsData.metrics);
      setRecommendations(
        recommendationsData.recommendations?.map((r: string, i: number) => ({
          priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
          action: r.split(":")[0] || r,
          rationale: r.split(":").slice(1).join(":").trim() || r,
        })) || []
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const executeCycle = async () => {
    setExecuting(true);
    try {
      const res = await fetch("/api/pos/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute-cycle" }),
      });

      if (!res.ok) {
        throw new Error("Failed to execute POS cycle");
      }

      const result = await res.json();
      if (result.success) {
        await loadData(); // Reload metrics
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute cycle");
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall POS Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Overall POS Score</CardTitle>
              <CardDescription>
                Comprehensive effectiveness of the Perception Operating System
              </CardDescription>
            </div>
            <Button
              onClick={executeCycle}
              disabled={executing}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${executing ? "animate-spin" : ""}`} />
              Execute Cycle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-4xl font-bold" data-testid="pos-score">
                {metrics ? Math.round(metrics.overall.posScore * 100) : 0}%
              </span>
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <Progress value={metrics ? metrics.overall.posScore * 100 : 0} className="h-3" />
            <p className="text-sm text-muted-foreground">
              {metrics && metrics.overall.posScore >= 0.8
                ? "Excellent - POS is highly effective"
                : metrics && metrics.overall.posScore >= 0.6
                ? "Good - POS is functioning well"
                : "Needs improvement - Review recommendations"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Component Metrics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bge">Belief Graph</TabsTrigger>
          <TabsTrigger value="consensus">Consensus</TabsTrigger>
          <TabsTrigger value="aaal">AI Authority</TabsTrigger>
          <TabsTrigger value="npe">Preemption</TabsTrigger>
          <TabsTrigger value="tsm">Trust</TabsTrigger>
          <TabsTrigger value="dfd">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* BGE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  Belief Graph Engineering
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.bge.weakNodesCount || 0}</div>
                <p className="text-xs text-muted-foreground">Weak nodes detected</p>
                <Progress
                  value={metrics ? metrics.bge.averageIrrelevance * 100 : 0}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Avg irrelevance: {metrics ? Math.round(metrics.bge.averageIrrelevance * 100) : 0}%
                </p>
              </CardContent>
            </Card>

            {/* Consensus */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Consensus Hijacking
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.consensus.totalSignals || 0}</div>
                <p className="text-xs text-muted-foreground">Consensus signals</p>
                <Progress
                  value={metrics ? metrics.consensus.consensusStrength * 100 : 0}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Strength: {metrics ? Math.round(metrics.consensus.consensusStrength * 100) : 0}%
                </p>
              </CardContent>
            </Card>

            {/* AAAL */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  AI Answer Authority
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? Math.round(metrics.aaal.citationScore * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">AI citation score</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Published content: {metrics?.aaal.publishedContent || 0}
                </p>
              </CardContent>
            </Card>

            {/* NPE */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Narrative Preemption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.npe.activePredictions || 0}</div>
                <p className="text-xs text-muted-foreground">Active predictions</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Preemptive actions: {metrics?.npe.preemptiveActions || 0}
                </p>
              </CardContent>
            </Card>

            {/* TSM */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Trust Substitution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? Math.round(metrics.tsm.trustScore * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Trust score</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Validators: {metrics?.tsm.validatorCount || 0}
                </p>
              </CardContent>
            </Card>

            {/* DFD */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Decision Funnel
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics ? Math.round(metrics.dfd.overallControl * 100) : 0}%
                </div>
                <p className="text-xs text-muted-foreground">Overall control</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Stages covered: {metrics?.dfd.stageCoverage || 0}/5
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="bge">
          <Card>
            <CardHeader>
              <CardTitle>Belief Graph Engineering</CardTitle>
              <CardDescription>
                Weak node detection and structural irrelevance scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Weak Nodes</p>
                    <p className="text-2xl font-bold">{metrics?.bge.weakNodesCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Average Irrelevance</p>
                    <p className="text-2xl font-bold">
                      {metrics ? Math.round(metrics.bge.averageIrrelevance * 100) : 0}%
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => window.open("/api/pos/belief-graph?action=find-weak", "_blank")}>
                  View Weak Nodes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consensus">
          <Card>
            <CardHeader>
              <CardTitle>Consensus Hijacking</CardTitle>
              <CardDescription>
                Third-party validators and expert commentary
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Total Signals</p>
                    <p className="text-2xl font-bold">{metrics?.consensus.totalSignals || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Consensus Strength</p>
                    <p className="text-2xl font-bold">
                      {metrics ? Math.round(metrics.consensus.consensusStrength * 100) : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aaal">
          <Card>
            <CardHeader>
              <CardTitle>AI Answer Authority Layer</CardTitle>
              <CardDescription>
                Structured rebuttals, incident explanations, and metrics dashboards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">AI Citation Score</p>
                    <p className="text-2xl font-bold">
                      {metrics ? Math.round(metrics.aaal.citationScore * 100) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Published Content</p>
                    <p className="text-2xl font-bold">{metrics?.aaal.publishedContent || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="npe">
          <Card>
            <CardHeader>
              <CardTitle>Narrative Preemption Engine</CardTitle>
              <CardDescription>
                Predictive complaint detection and preemptive actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Active Predictions</p>
                    <p className="text-2xl font-bold">{metrics?.npe.activePredictions || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Preemptive Actions</p>
                    <p className="text-2xl font-bold">{metrics?.npe.preemptiveActions || 0}</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => window.open("/api/pos/preemption?action=predict", "_blank")}>
                  Run Predictions
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tsm">
          <Card>
            <CardHeader>
              <CardTitle>Trust Substitution Mechanism</CardTitle>
              <CardDescription>
                External validators, audits, and SLAs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Trust Score</p>
                    <p className="text-2xl font-bold">
                      {metrics ? Math.round(metrics.tsm.trustScore * 100) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Validators</p>
                    <p className="text-2xl font-bold">{metrics?.tsm.validatorCount || 0}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dfd">
          <Card>
            <CardHeader>
              <CardTitle>Decision Funnel Domination</CardTitle>
              <CardDescription>
                Control at every decision checkpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium">Overall Control</p>
                    <p className="text-2xl font-bold">
                      {metrics ? Math.round(metrics.dfd.overallControl * 100) : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Stages Covered</p>
                    <p className="text-2xl font-bold">{metrics?.dfd.stageCoverage || 0}/5</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Actionable recommendations to improve POS effectiveness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <Alert
                  key={i}
                  variant={rec.priority === "high" ? "destructive" : "default"}
                >
                  <div className="flex items-start gap-2">
                    {rec.priority === "high" ? (
                      <AlertTriangle className="h-4 w-4 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{rec.action}</p>
                      <p className="text-sm text-muted-foreground mt-1">{rec.rationale}</p>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
