"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Globe, Shield, TriangleAlert, TrendingUp, Filter, Search, BarChart3, Sparkles, ArrowRight, Target } from "@/components/demo-icons";
import { TrustGapMap } from "@/components/trust-gap-map";
import { ExplainScoreDrawer } from "@/components/explain-score-drawer";

type TrustArtifact = {
  id: string;
  title: string;
  status: string;
  version: string;
  padlPublished: boolean;
  padlUrl?: string | null;
  updatedAt: string;
};

type Cluster = {
  id: string;
  size: number;
  decisiveness: number;
  primaryClaim: { canonicalText: string };
};

function TrustPageContent() {
  const searchParams = useSearchParams();
  const focusAsset = searchParams.get("asset");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artifacts, setArtifacts] = useState<TrustArtifact[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [trustScores, setTrustScores] = useState<Record<string, number>>({});
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [aaalRes, clustersRes] = await Promise.all([
          fetch("/api/aaal"),
          fetch("/api/claims/clusters"),
        ]);

        if (!aaalRes.ok) throw new Error("Failed to load trust artifacts");
        if (!clustersRes.ok) throw new Error("Failed to load clusters");

        const aaal = await aaalRes.json();
        const cls = await clustersRes.json();

        if (cancelled) return;

        setArtifacts(aaal);
        setClusters(cls);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load trust data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const trustArtifacts = useMemo(() => {
    let filtered = artifacts.filter((a) => a.padlPublished || a.status === "PUBLISHED");
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((a) =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter (would need type field in artifacts)
    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (!focusAsset) return filtered;
    return filtered.sort((a) => (a.id === focusAsset ? -1 : 1));
  }, [artifacts, focusAsset, searchQuery, filterStatus]);

  const topClusters = useMemo(() => {
    return (clusters || []).slice(0, 10);
  }, [clusters]);

  const gapMap = useMemo(() => {
    // Coverage heuristic: cluster is "covered" if a published artifact title overlaps
    // with the primary claim keywords.
    const publishedTitles = trustArtifacts.map((a) => a.title.toLowerCase());
    return topClusters.map((c) => {
      const claim = c.primaryClaim?.canonicalText || "";
      const keywords = claim
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ""))
        .filter((w) => w.length >= 5)
        .slice(0, 8);

      const covered = keywords.some((k) => publishedTitles.some((t) => t.includes(k)));
      return { cluster: c, covered };
    });
  }, [topClusters, trustArtifacts]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <Shield className="size-6 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Trust Assets Intelligence
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl">
            Comprehensive trust asset management with published artifacts, coverage gap analysis, and PADL integration. Monitor trust scores, identify gaps, and optimize your trust portfolio.
          </p>
        </div>

        {loading ? (
          <LoadingState count={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => window.location.reload()} />
        ) : (
          <>
            {/* Trust Score Overview */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                  <div className="p-1.5 rounded-md bg-amber-500/10">
                    <Shield className="size-4 text-amber-600 dark:text-amber-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{trustArtifacts.length}</div>
                  <p className="text-xs text-muted-foreground">Published artifacts</p>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Trust Score</CardTitle>
                  <div className="p-1.5 rounded-md bg-blue-500/10">
                    <BarChart3 className="size-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.keys(trustScores).length > 0
                      ? Math.round(
                          (Object.values(trustScores).reduce((a, b) => a + b, 0) /
                            Object.values(trustScores).length) *
                            100
                        )
                      : 0}
                    %
                  </div>
                  <Progress
                    value={
                      Object.keys(trustScores).length > 0
                        ? (Object.values(trustScores).reduce((a, b) => a + b, 0) /
                            Object.values(trustScores).length) *
                          100
                        : 0
                    }
                    className="mt-2"
                  />
                </CardContent>
              </Card>
              <Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Coverage Ratio</CardTitle>
                  <div className="p-1.5 rounded-md bg-green-500/10">
                    <TrendingUp className="size-4 text-green-600 dark:text-green-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {clusters.length > 0
                      ? Math.round(
                          (gapMap.filter((g) => g.covered).length / gapMap.length) * 100
                        )
                      : 0}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Clusters with assets
                  </p>
                </CardContent>
              </Card>
              <Card className="transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Gaps</CardTitle>
                  <div className="p-1.5 rounded-md bg-red-500/10">
                    <TriangleAlert className="size-4 text-destructive" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {gapMap.filter((g) => !g.covered).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Uncovered clusters</p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="assets" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="assets" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Shield className="mr-2 size-4" />
                  Trust Assets
                </TabsTrigger>
                <TabsTrigger value="gaps" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Target className="mr-2 size-4" />
                  Trust Gaps
                </TabsTrigger>
                <TabsTrigger value="recommendations" className="transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Sparkles className="mr-2 size-4" />
                  Recommendations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="assets" className="space-y-4">
                <Card className="transition-all duration-200 hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Shield className="size-5 text-primary" />
                          <CardTitle className="font-semibold">Trust Assets Library</CardTitle>
                        </div>
                        <CardDescription>
                          Published artifacts available for citation and procurement with full trust scoring
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                          <Input
                            placeholder="Search assets..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                          />
                        </div>
                      </div>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="PUBLISHED">Published</SelectItem>
                          <SelectItem value="APPROVED">Approved</SelectItem>
                          <SelectItem value="DRAFT">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {trustArtifacts.length === 0 ? (
                      <EmptyState
                        title="No trust assets found"
                        description="Publish an AAAL artifact to PADL to appear here"
                        action={{
                          label: "Create Artifact",
                          onClick: () => window.location.href = "/studio",
                        }}
                      />
                    ) : (
                      <div className="space-y-3">
                        {trustArtifacts.map((asset) => {
                          const trustScore = trustScores[asset.id] || 0.75;
                          return (
                            <div
                              key={asset.id}
                              className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors"
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <Shield className="size-5 text-primary flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="font-medium truncate">{asset.title}</div>
                                    <Badge variant={asset.padlPublished ? "default" : "secondary"}>
                                      {asset.padlPublished ? "published" : "internal"}
                                    </Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground mb-2">
                                    Version {asset.version} • {asset.status}
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">Trust Score:</span>
                                      <div className="flex items-center gap-2">
                                        <Progress value={trustScore * 100} className="w-24 h-2" />
                                        <span className="text-xs font-medium">
                                          {Math.round(trustScore * 100)}%
                                        </span>
                                        <ExplainScoreDrawer
                                          scoreType="trust"
                                          entityType="artifact"
                                          entityId={asset.id}
                                          trigger={
                                            <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                                              <BarChart3 className="size-3" />
                                            </Button>
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {asset.padlUrl && (
                                  <Button asChild variant="outline" size="sm">
                                    <Link href={asset.padlUrl} target="_blank" rel="noreferrer">
                                      <Globe className="mr-2 size-4" />
                                      View
                                    </Link>
                                  </Button>
                                )}
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/studio?artifact=${asset.id}`}>Edit</Link>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="gaps" className="space-y-4">
                <TrustGapMap />
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                <Card className="transition-all duration-200 hover:shadow-md">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-5 text-primary" />
                      <CardTitle className="font-semibold">Trust Recommendations</CardTitle>
                    </div>
                    <CardDescription>
                      AI-suggested strategic actions to improve trust coverage and optimize your trust portfolio
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {recommendations.map((rec) => (
                          <div
                            key={rec.id}
                            className="flex items-start justify-between rounded-lg border p-4"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant={
                                    rec.priority === "high"
                                      ? "destructive"
                                      : rec.priority === "medium"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {rec.priority}
                                </Badge>
                                <span className="font-medium">{rec.action}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{rec.rationale}</p>
                              {rec.cluster_id && (
                                <div className="mt-2">
                                  <Button variant="outline" size="sm" asChild>
                                    <Link href={`/claims/${rec.cluster_id}`}>
                                      View Cluster
                                    </Link>
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No recommendations"
                        description="All trust assets are up to date"
                      />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

          </>
        )}
      </div>
    </AppShell>
  );
}

export default function TrustPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TrustPageContent />
    </Suspense>
  );
}
