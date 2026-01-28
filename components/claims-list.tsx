"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Search, Sparkles, Loader2 } from "@/components/demo-icons";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ExplainScoreDrawer } from "@/components/explain-score-drawer";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";

interface Claim {
  id: string;
  canonicalText: string;
  variants: string[];
  decisiveness: number;
  clusterId?: string;
  createdAt: string;
}

export function ClaimsList({ clusterId }: { clusterId?: string }) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "decisiveness" | "cluster">("recent");
  const [aiAnalyzing, setAiAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchClaims() {
      try {
        const url = clusterId
          ? `/api/claims?cluster_id=${clusterId}`
          : "/api/claims";
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch claims: ${response.statusText}`);
        }
        const data = await response.json();
        if (!cancelled) {
          setClaims(data);
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

    fetchClaims();
    return () => {
      cancelled = true;
    };
  }, [clusterId]);

  const filteredAndSortedClaims = useMemo(() => {
    let filtered = claims;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.canonicalText.toLowerCase().includes(query) ||
          c.variants.some((v) => v.toLowerCase().includes(query))
      );
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "decisiveness") {
        return b.decisiveness - a.decisiveness;
      }
      if (sortBy === "cluster") {
        if (a.clusterId && !b.clusterId) return -1;
        if (!a.clusterId && b.clusterId) return 1;
        return 0;
      }
      // recent
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted;
  }, [claims, searchQuery, sortBy]);

  const handleAIAnalysis = async (claimId: string) => {
    setAiAnalyzing(claimId);
    try {
      const response = await fetch("/api/ai/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `Analyze this claim for factual accuracy and provide supporting or contradicting evidence: ${claims.find((c) => c.id === claimId)?.canonicalText}`,
          use_graphrag: true,
          use_composite: true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // Show analysis results - would display in UI
        // Analysis results available in data
      }
    } catch (error) {
      // Error handling - would show toast or error state
      // Silently fail for now, could add toast notification
    } finally {
      setAiAnalyzing(null);
    }
  };

  if (loading) {
    return <LoadingState count={3} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  if (claims.length === 0) {
    return (
      <EmptyState
        title="No claims found"
        description="Claims will appear here once extracted from signals"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search claims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                aria-label="Search claims"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="decisiveness">Decisiveness</SelectItem>
                <SelectItem value="cluster">Clustered</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Claims List */}
      {filteredAndSortedClaims.length > 0 ? (
        filteredAndSortedClaims.map((claim) => (
          <Card key={claim.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-base">{claim.canonicalText}</CardTitle>
                <CardDescription className="mt-2">
                  {claim.variants.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {claim.variants.map((variant, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {variant}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardDescription>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-2 justify-end">
                  <div className="text-sm font-medium">
                    Decisiveness: {claim.decisiveness.toFixed(2)}
                  </div>
                  <ExplainScoreDrawer
                    entityType="claim"
                    entityId={claim.id}
                    scoreType="decisiveness"
                  />
                </div>
                {claim.clusterId && (
                  <Badge variant="secondary" className="mt-1">
                    Clustered
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Created: {new Date(claim.createdAt).toLocaleString()}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAIAnalysis(claim.id)}
                  disabled={aiAnalyzing === claim.id}
                  aria-label={`Analyze claim ${claim.canonicalText.substring(0, 50)} with AI`}
                >
                  {aiAnalyzing === claim.id ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      AI Analysis
                    </>
                  )}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/claims/${claim.id}`} aria-label={`View details for claim ${claim.canonicalText.substring(0, 50)}`}>
                    View Details
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        ))
      ) : (
        <EmptyState
          title="No matching claims"
          description={`No claims found matching "${searchQuery}"`}
        />
      )}
    </div>
  );
}
