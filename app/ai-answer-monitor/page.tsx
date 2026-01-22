/**
 * AI Answer Monitor Page
 * Monitor AI system citations and track how brands are represented
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

interface CitationMetrics {
  totalCitations: number;
  citationsByEngine: Record<string, number>;
  citationRate: number;
  topQueries: Array<{ query: string; count: number }>;
}

interface Citation {
  id: string;
  engine: string;
  query: string;
  answer: string;
  citations: Array<{ url: string; title?: string; snippet?: string }>;
  timestamp: string;
  sourceUrl?: string;
  tone: "positive" | "neutral" | "negative" | "mixed";
}

export default function AIAnswerMonitorPage() {
  const [query, setQuery] = useState("");
  const [monitoring, setMonitoring] = useState(false);
  const [metrics, setMetrics] = useState<CitationMetrics | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>("all");

  useEffect(() => {
    loadData();
  }, [selectedEngine]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-answer-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get-history",
          days: 30,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to load monitoring data");
      }

      const data = await response.json();
      if (data.success) {
        // Transform snapshots to citations format
        const transformedCitations = (data.snapshots || []).map((snapshot: any) => ({
          id: snapshot.id,
          engine: snapshot.engine,
          query: snapshot.query,
          answer: snapshot.answer,
          citations: Array.isArray(snapshot.citations)
            ? snapshot.citations.map((url: string) => ({ url }))
            : [],
          timestamp: snapshot.timestamp,
          tone: snapshot.tone || "neutral",
        }));

        // Filter by selected engine
        const filtered = selectedEngine === "all"
          ? transformedCitations
          : transformedCitations.filter((c: any) => c.engine === selectedEngine);

        setCitations(filtered);

        // Calculate metrics from snapshots
        const totalCitations = transformedCitations.reduce(
          (sum: number, c: any) => sum + c.citations.length,
          0
        );
        const citationsByEngine: Record<string, number> = {};
        transformedCitations.forEach((c: any) => {
          citationsByEngine[c.engine] = (citationsByEngine[c.engine] || 0) + c.citations.length;
        });

        setMetrics({
          totalCitations,
          citationsByEngine,
          citationRate: transformedCitations.length > 0
            ? (totalCitations / transformedCitations.length) * 100
            : 0,
          topQueries: [],
        });
      } else {
        throw new Error(data.error || "Failed to load data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function handleMonitor() {
    if (!query.trim()) return;

    setMonitoring(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-answer-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "snapshot",
          query: query.trim(),
          engine: "perplexity", // Default to perplexity for now
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start monitoring");
      }

      const data = await response.json();
      if (data.success) {
        // Reload data after monitoring
        setTimeout(() => {
          loadData();
          setQuery("");
        }, 2000);
      } else {
        throw new Error(data.error || "Failed to monitor");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to monitor");
    } finally {
      setMonitoring(false);
    }
  }

  const filteredCitations = selectedEngine === "all"
    ? citations
    : citations.filter((c) => c.engine === selectedEngine);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">AI Answer Monitor</h1>
            <p className="text-muted-foreground mt-1">
              Monitor how AI systems cite and represent your brand
            </p>
          </div>
          <Button onClick={loadData} variant="outline" size="sm">
            <RefreshCw className="mr-2 size-4" />
            Refresh
          </Button>
        </div>

        {/* Monitor Query */}
        <Card>
          <CardHeader>
            <CardTitle>Monitor New Query</CardTitle>
            <CardDescription>
              Track how AI systems answer specific queries about your brand
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Enter query to monitor (e.g., 'What is Holdwall?')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMonitor()}
                disabled={monitoring}
              />
              <Button onClick={handleMonitor} disabled={monitoring || !query.trim()}>
                {monitoring ? (
                  <>
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Monitoring...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Monitor
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Metrics */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Citations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.totalCitations}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all engines</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Citation Rate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.citationRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">Of monitored queries</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Top Engine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {Object.entries(metrics.citationsByEngine).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Most citations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Monitored Queries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics.topQueries.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Unique queries</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Citations Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Citations</CardTitle>
                <CardDescription>
                  Track citations across AI answer engines
                </CardDescription>
              </div>
              <Tabs value={selectedEngine} onValueChange={setSelectedEngine}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                  <TabsTrigger value="perplexity">Perplexity</TabsTrigger>
                  <TabsTrigger value="gemini">Gemini</TabsTrigger>
                  <TabsTrigger value="claude">Claude</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState count={3} />
            ) : filteredCitations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Engine</TableHead>
                    <TableHead>Query</TableHead>
                    <TableHead>Citations</TableHead>
                    <TableHead>Tone</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCitations.map((citation) => (
                    <TableRow key={citation.id}>
                      <TableCell>
                        <Badge variant="outline">{citation.engine}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate">{citation.query}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ExternalLink className="size-4 text-muted-foreground" />
                          <span>{citation.citations.length}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            citation.tone === "positive"
                              ? "default"
                              : citation.tone === "negative"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {citation.tone}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(citation.timestamp).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={citation.sourceUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No citations found"
                description="Start monitoring queries to track citations across AI answer engines"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
