"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Radio, Link2, AlertTriangle, TrendingUp, BarChart3, Zap, Copy, Sparkles, CheckCircle2, XCircle, AlertCircle, Download, FileDown, MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, CheckSquare, Square, Trash2, Archive, Filter, Search, Settings2, Activity, TrendingDown, Clock, Globe, Users, MessageSquare, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState } from "@/components/ui/loading-states";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { SeverityBadge } from "@/components/severity-badge";
import { EvidenceLink } from "@/components/evidence-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Signal {
  evidence_id: string;
  tenant_id: string;
  type: string;
  source: {
    type: string;
    id: string;
    url?: string;
    collected_at: string;
    collected_by: string;
    method: string;
  };
  content: {
    raw?: string;
    normalized?: string;
    metadata?: Record<string, unknown>;
  };
  metadata?: {
    severity?: "low" | "medium" | "high" | "critical";
    suggested_cluster_id?: string;
    suggested_cluster_confidence?: number;
    dedup_likely?: boolean;
    extracted_claims?: Array<{ text: string; confidence: number }>;
    high_risk?: boolean;
  } & Record<string, unknown>;
  created_at: string;
}

interface SourceHealth {
  source_type: string;
  status: "healthy" | "degraded" | "unhealthy";
  last_success: string;
  error_rate: number;
}

interface SignalsDataProps {
  tabFilter?: "all" | "high-risk" | "unclustered";
}

function SignalInsightsTab({ signal, onLinkCluster }: { signal: Signal; onLinkCluster: (clusterId: string) => void }) {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchInsights() {
      try {
        const res = await fetch(`/api/signals/insights?evidence_id=${signal.evidence_id}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setInsights(data.insights);
        }
      } catch (err) {
        console.error("Failed to load insights:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchInsights();
    return () => {
      cancelled = true;
    };
  }, [signal.evidence_id]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading insights...</div>
        </CardContent>
      </Card>
    );
  }

  if (!insights) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">No insights available</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-2">Risk Level</div>
            <Badge variant={
              insights.riskLevel === "high" ? "destructive" :
              insights.riskLevel === "medium" ? "default" : "secondary"
            }>
              {insights.riskLevel.toUpperCase()}
            </Badge>
          </div>
          {insights.recommendedActions && insights.recommendedActions.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2">Recommended Actions</div>
              <ul className="space-y-1 text-sm">
                {insights.recommendedActions.map((action: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {insights.clusterRecommendation && (
            <div>
              <div className="text-sm font-medium mb-2">Cluster Recommendation</div>
              <div className="text-sm text-muted-foreground mb-2">
                Suggested cluster with {(insights.clusterRecommendation.confidence * 100).toFixed(0)}% confidence
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onLinkCluster(insights.clusterRecommendation.clusterId)}
              >
                Link to Suggested Cluster
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SignalsData({ tabFilter = "all" }: SignalsDataProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string>("");
  const [clusters, setClusters] = useState<Array<{ id: string; primary_claim: string }>>([]);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [amplificationData, setAmplificationData] = useState<Record<string, number[]>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [timeframeFilter, setTimeframeFilter] = useState<string>("24h");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedSignals, setSelectedSignals] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"date" | "severity" | "amplification" | "source">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [analytics, setAnalytics] = useState<any>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [searchMode, setSearchMode] = useState<"standard" | "semantic">("standard");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSignals() {
      try {
        const params = new URLSearchParams();
        if (sourceFilter !== "all") params.append("source", sourceFilter);
        if (severityFilter !== "all") params.append("severity", severityFilter);
        if (languageFilter !== "all") params.append("language", languageFilter);
        params.append("timeframe", timeframeFilter);

        const [signalsRes, analyticsRes] = await Promise.all([
          fetch(`/api/signals?${params}`),
          fetch(`/api/signals/analytics?timeframe=${timeframeFilter}`),
        ]);

        if (!signalsRes.ok) {
          throw new Error("Failed to fetch signals");
        }
        const data = await signalsRes.json();
        if (!cancelled) {
          const signalsArray = Array.isArray(data) ? data : [];
          setSignals(signalsArray);
          
          // Fetch amplification data for all signals
          if (signalsArray.length > 0) {
            const evidenceIds = signalsArray.map((s: Signal) => s.evidence_id);
            try {
              const ampResponse = await fetch("/api/signals/amplification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ evidence_ids: evidenceIds }),
              });
              if (ampResponse.ok && !cancelled) {
                const ampData = await ampResponse.json();
                setAmplificationData(ampData.amplification || {});
              }
            } catch (err) {
              console.error("Failed to fetch amplification data:", err);
            }
          }
        }

        // Fetch analytics
        if (analyticsRes.ok && !cancelled) {
          const analyticsData = await analyticsRes.json();
          setAnalytics(analyticsData);
        }

        // Fetch insights
        try {
          const insightsRes = await fetch("/api/signals/insights");
          if (insightsRes.ok && !cancelled) {
            const insightsData = await insightsRes.json();
            setInsights(insightsData.insights);
          }
        } catch (err) {
          console.error("Failed to fetch insights:", err);
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

    fetchSignals();
    return () => {
      cancelled = true;
    };
  }, [sourceFilter, severityFilter, languageFilter, timeframeFilter]);

  // SSE connection for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    function connectSSE() {
      try {
        eventSource = new EventSource("/api/signals/stream");
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "signal" && data.evidence_id) {
              // Fetch the new signal and add it to the list
              fetch(`/api/signals?limit=1&evidence=${data.evidence_id}`)
                .then((res) => res.json())
                .then((newSignals) => {
                  if (Array.isArray(newSignals) && newSignals.length > 0) {
                    setSignals((prev) => {
                      // Avoid duplicates
                      const exists = prev.some((s) => s.evidence_id === newSignals[0].evidence_id);
                      if (exists) return prev;
                      return [newSignals[0], ...prev];
                    });
                  }
                })
                .catch((err) => console.error("Failed to fetch new signal:", err));
            } else if (data.type === "heartbeat") {
              // Keep connection alive
              setIsConnected(true);
            }
          } catch (err) {
            console.error("Failed to parse SSE message:", err);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE connection error:", error);
          setIsConnected(false);
          // Attempt to reconnect after a delay
          setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
              eventSource?.close();
              connectSSE();
            }
          }, 5000);
        };
      } catch (err) {
        console.error("Failed to create SSE connection:", err);
        setIsConnected(false);
      }
    }

    connectSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchSourceHealth() {
      try {
        const response = await fetch("/api/sources/health");
        if (response.ok && !cancelled) {
          const data = await response.json();
          setSourceHealth(data.sources || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load source health:", err);
        }
      }
    }

    fetchSourceHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchClusters() {
      try {
        const response = await fetch("/api/claims/clusters");
        if (response.ok && !cancelled) {
          const data = await response.json();
          setClusters(
            data.map((c: any) => ({
              id: c.id,
              primary_claim: c.primaryClaim?.canonicalText || "Unknown",
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch clusters:", err);
        }
      }
    }
    fetchClusters();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLinkToCluster = async (evidenceId: string) => {
    if (!selectedCluster) {
      toast.error("Please select a cluster");
      return;
    }

    setProcessing((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      const response = await fetch("/api/signals/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "link_to_cluster",
          evidence_id: evidenceId,
          cluster_id: selectedCluster,
        }),
      });

      if (response.ok) {
        toast.success("Signal linked to cluster");
        setLinkDialogOpen(null);
        setSelectedCluster("");
        router.push(`/claims?cluster=${selectedCluster}`);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to link to cluster");
      }
    } catch (error) {
      toast.error("Failed to link to cluster");
    } finally {
      setProcessing((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  const handleCreateCluster = async (evidenceId: string) => {
    setProcessing((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      const response = await fetch("/api/signals/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_cluster",
          evidence_id: evidenceId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Cluster created successfully");
        if (data.cluster_id) {
          router.push(`/claims?cluster=${data.cluster_id}`);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to create cluster");
      }
    } catch (error) {
      toast.error("Failed to create cluster");
    } finally {
      setProcessing((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  const handleMarkHighRisk = async (evidenceId: string, isHighRisk: boolean) => {
    setProcessing((prev) => ({ ...prev, [evidenceId]: true }));
    try {
      const response = await fetch("/api/signals/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_high_risk",
          evidence_id: evidenceId,
          is_high_risk: isHighRisk,
        }),
      });

      if (response.ok) {
        toast.success(isHighRisk ? "Signal marked as high-risk" : "High-risk flag removed");
        // Refresh signals
        const refreshResponse = await fetch("/api/signals");
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setSignals(data);
        }
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to update risk status");
      }
    } catch (error) {
      toast.error("Failed to update risk status");
    } finally {
      setProcessing((prev) => ({ ...prev, [evidenceId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
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
        title="Failed to load signals"
        description="Unable to fetch signals. Please try again."
      />
    );
  }

  if (signals.length === 0) {
    return (
      <EmptyState
        title="No signals found"
        description="Connect sources to start ingesting signals"
        action={{
          label: "Go to Sources",
          onClick: () => router.push("/governance/sources"),
        }}
      />
    );
  }

  const evidenceFilter = searchParams.get("evidence");
  const authorFilter = searchParams.get("author");

  const filteredSignals = signals.filter((s) => {
    // Tab-based filtering
    if (tabFilter === "high-risk") {
      if (!(s.metadata as any)?.high_risk) return false;
    } else if (tabFilter === "unclustered") {
      // Unclustered means no cluster_id (linked) and no suggested_cluster_id
      const metadata = s.metadata as any;
      if (metadata?.cluster_id || metadata?.suggested_cluster_id) return false;
    }

    // URL parameter filters
    if (evidenceFilter && s.evidence_id !== evidenceFilter) return false;
    if (authorFilter) {
      const author = (s.content.metadata as any)?.author;
      if (!author || String(author).toLowerCase() !== authorFilter.toLowerCase()) return false;
    }
    
    // UI filter controls
    if (sourceFilter !== "all" && s.source.type !== sourceFilter) return false;
    if (severityFilter !== "all" && s.metadata?.severity !== severityFilter) return false;
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (searchMode === "semantic") {
        // For semantic search, we'd use the AI search API
        // For now, use enhanced text matching
        const content = `${s.content.raw || ""} ${s.content.normalized || ""}`.toLowerCase();
        const sourceType = (s.source.type || "").toLowerCase();
        const metadataStr = JSON.stringify(s.metadata || {}).toLowerCase();
        const searchTerms = searchLower.split(/\s+/);
        const matches = searchTerms.some(term => 
          content.includes(term) || 
          sourceType.includes(term) || 
          metadataStr.includes(term)
        );
        if (!matches) return false;
      } else {
        // Standard search
        const content = `${s.content.raw || ""} ${s.content.normalized || ""}`.toLowerCase();
        const sourceType = (s.source.type || "").toLowerCase();
        if (!content.includes(searchLower) && !sourceType.includes(searchLower)) return false;
      }
    }
    return true;
  });

  // Sort signals
  const sortedSignals = [...filteredSignals].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case "date":
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        comparison = dateB - dateA;
        break;
      case "severity":
        const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityA = severityOrder[a.metadata?.severity || "low"] || 0;
        const severityB = severityOrder[b.metadata?.severity || "low"] || 0;
        comparison = severityB - severityA;
        break;
      case "amplification":
        const ampA = getAmplificationScore(a.evidence_id);
        const ampB = getAmplificationScore(b.evidence_id);
        comparison = ampB - ampA;
        break;
      case "source":
        comparison = (a.source.type || "").localeCompare(b.source.type || "");
        break;
    }
    
    return sortOrder === "asc" ? -comparison : comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedSignals.length / pageSize);
  const paginatedSignals = sortedSignals.slice((page - 1) * pageSize, page * pageSize);

  // Bulk action handlers
  const handleSelectAll = () => {
    if (selectedSignals.size === paginatedSignals.length && 
        paginatedSignals.every(s => selectedSignals.has(s.evidence_id))) {
      // Deselect all on current page
      const newSelected = new Set(selectedSignals);
      paginatedSignals.forEach(s => newSelected.delete(s.evidence_id));
      setSelectedSignals(newSelected);
    } else {
      // Select all on current page
      const newSelected = new Set(selectedSignals);
      paginatedSignals.forEach(s => newSelected.add(s.evidence_id));
      setSelectedSignals(newSelected);
    }
  };

  const handleSelectSignal = (evidenceId: string) => {
    const newSelected = new Set(selectedSignals);
    if (newSelected.has(evidenceId)) {
      newSelected.delete(evidenceId);
    } else {
      newSelected.add(evidenceId);
    }
    setSelectedSignals(newSelected);
  };

  const handleBulkAction = async (action: "mark_high_risk" | "link_to_cluster" | "export") => {
    if (selectedSignals.size === 0) {
      toast.error("No signals selected");
      return;
    }

    setBulkActionLoading(true);
    try {
      if (action === "export") {
        const selected = sortedSignals.filter(s => selectedSignals.has(s.evidence_id));
        const csv = [
          ["Evidence ID", "Source", "Severity", "Content", "Created At", "High Risk", "Cluster ID"].join(","),
          ...selected.map(s => [
            s.evidence_id,
            s.source.type,
            s.metadata?.severity || "low",
            `"${(s.content.normalized || s.content.raw || "").replace(/"/g, '""')}"`,
            s.created_at,
            (s.metadata as any)?.high_risk ? "Yes" : "No",
            (s.metadata as any)?.cluster_id || "",
          ].join(",")),
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `signals-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`Exported ${selectedSignals.size} signals`);
        setSelectedSignals(new Set());
      } else if (action === "mark_high_risk") {
        const promises = Array.from(selectedSignals).map(evidenceId =>
          fetch("/api/signals/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "mark_high_risk",
              evidence_id: evidenceId,
              is_high_risk: true,
            }),
          })
        );
        await Promise.all(promises);
        toast.success(`Marked ${selectedSignals.size} signals as high-risk`);
        setSelectedSignals(new Set());
        // Refresh signals
        window.location.reload();
      }
    } catch (error) {
      toast.error("Failed to perform bulk action");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [sourceFilter, severityFilter, languageFilter, timeframeFilter, searchQuery, tabFilter, sortBy, sortOrder]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + A: Select all on current page
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      }
      // Ctrl/Cmd + E: Export selected
      if ((e.ctrlKey || e.metaKey) && e.key === "e") {
        e.preventDefault();
        if (selectedSignals.size > 0) {
          handleBulkAction("export");
        }
      }
      // Escape: Clear selection
      if (e.key === "Escape") {
        setSelectedSignals(new Set());
      }
      // Arrow keys for pagination
      if (e.key === "ArrowLeft" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPage(p => Math.max(1, p - 1));
      }
      if (e.key === "ArrowRight" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPage(p => Math.min(totalPages, p + 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSignals, paginatedSignals, totalPages]);

  if (sortedSignals.length === 0) {
    return (
      <div className="space-y-6">
        {showAnalytics && analytics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{analytics.highRisk}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Unclustered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{analytics.unclustered}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Amplification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.averageAmplification.toFixed(2)}</div>
              </CardContent>
            </Card>
          </div>
        )}
        <EmptyState
          title="No matching signals"
          description="Try adjusting your filters or check a different timeframe"
          action={{
            label: "Clear Filters",
            onClick: () => {
              setSourceFilter("all");
              setSeverityFilter("all");
              setLanguageFilter("all");
              setTimeframeFilter("24h");
              setSearchQuery("");
              router.push("/signals");
            },
          }}
        />
      </div>
    );
  }

  function getAmplificationScore(evidenceId: string): number {
    const data = amplificationData[evidenceId];
    if (!data || data.length === 0) return 0;
    return data[data.length - 1] || 0;
  }

  function getSourceHealthIcon(status: "healthy" | "degraded" | "unhealthy") {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="size-4 text-green-600" />;
      case "degraded":
        return <AlertCircle className="size-4 text-yellow-600" />;
      case "unhealthy":
        return <XCircle className="size-4 text-destructive" />;
    }
  }

  function renderAmplificationChart(evidenceId: string) {
    const data = amplificationData[evidenceId];
    if (!data || data.length === 0) {
      return (
        <div className="text-xs text-muted-foreground">No amplification data</div>
      );
    }

    const maxValue = Math.max(...data, 1);
    const score = getAmplificationScore(evidenceId);

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Amplification</span>
          <span className="font-medium">{score.toFixed(1)}</span>
        </div>
        <div className="flex items-end gap-0.5 h-8">
          {data.slice(-7).map((value, i) => (
            <div
              key={i}
              className="flex-1 bg-primary/20 rounded-t"
              style={{ height: `${(value / maxValue) * 100}%` }}
              title={`${value.toFixed(1)} at ${i + 1}h ago`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Analytics Dashboard */}
      {showAnalytics && analytics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.total}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                {analytics.trend.direction === "increasing" ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : analytics.trend.direction === "decreasing" ? (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                ) : (
                  <Activity className="h-3 w-3 text-muted-foreground" />
                )}
                <span>{Math.abs(analytics.trend.value).toFixed(1)}% vs previous period</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{analytics.highRisk}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {analytics.total > 0 ? ((analytics.highRisk / analytics.total) * 100).toFixed(1) : 0}% of total
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unclustered</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{analytics.unclustered}</div>
              <div className="text-xs text-muted-foreground mt-1">Requires attention</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Amplification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.averageAmplification.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground mt-1">Across all signals</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Charts */}
      {showAnalytics && analytics && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Source Distribution */}
          {Object.keys(analytics.bySource).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Source Distribution</CardTitle>
                <CardDescription>Signals by source type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.bySource)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([source, count]) => {
                      const percentage = analytics.total > 0 
                        ? ((count as number) / analytics.total) * 100 
                        : 0;
                      return (
                        <div key={source} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize font-medium">{source}</span>
                            <span className="text-muted-foreground">
                              {count as number} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Severity Distribution */}
          {Object.keys(analytics.bySeverity).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Severity Distribution</CardTitle>
                <CardDescription>Signals by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(["critical", "high", "medium", "low"] as const).map((severity) => {
                    const count = analytics.bySeverity[severity] || 0;
                    const percentage = analytics.total > 0 
                      ? (count / analytics.total) * 100 
                      : 0;
                    if (count === 0) return null;
                    return (
                      <div key={severity} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <SeverityBadge severity={severity} />
                            <span className="capitalize font-medium">{severity}</span>
                          </div>
                          <span className="text-muted-foreground">
                            {count} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Time Series Chart */}
          {analytics.timeSeries && analytics.timeSeries.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Signal Volume Over Time</CardTitle>
                <CardDescription>Last 24 hours - hourly breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-end gap-1 h-32">
                    {analytics.timeSeries.map((item: { timestamp: string; count: number }, idx: number) => {
                      const maxCount = Math.max(...analytics.timeSeries.map((i: { count: number }) => i.count), 1);
                      const height = (item.count / maxCount) * 100;
                      const time = new Date(item.timestamp).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      });
                      return (
                        <TooltipProvider key={idx}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition-colors cursor-pointer"
                                style={{ height: `${Math.max(height, 5)}%` }}
                                title={`${item.count} signals at ${time}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{time}: {item.count} signals</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{new Date(analytics.timeSeries[0]?.timestamp || "").toLocaleTimeString("en-US", { hour: "numeric" })}</span>
                    <span>{new Date(analytics.timeSeries[analytics.timeSeries.length - 1]?.timestamp || "").toLocaleTimeString("en-US", { hour: "numeric" })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Main Signals Stream */}
        <div className="space-y-4 min-w-0">
          {/* Toolbar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <Checkbox
                    checked={paginatedSignals.length > 0 && paginatedSignals.every(s => selectedSignals.has(s.evidence_id))}
                    onCheckedChange={handleSelectAll}
                    className="mr-2"
                  />
                  {selectedSignals.size > 0 ? (
                    <>
                      <span className="text-sm font-medium">
                        {selectedSignals.size} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSignals(new Set())}
                        className="h-7 px-2"
                      >
                        Clear
                      </Button>
                      <Separator orientation="vertical" className="h-6" />
                      <div className="flex gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkAction("mark_high_risk")}
                                disabled={bulkActionLoading}
                              >
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Mark High Risk
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Mark selected signals as high-risk</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleBulkAction("export")}
                                disabled={bulkActionLoading}
                              >
                                <Download className="mr-1 h-3 w-3" />
                                Export
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Export selected signals to CSV (Ctrl+E)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {sortedSignals.length} signal{sortedSignals.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <ArrowUpDown className="mr-2 h-4 w-4" />
                              Sort: {sortBy}
                              {sortOrder === "asc" ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />}
                            </Button>
                          </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Sort By</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {(["date", "severity", "amplification", "source"] as const).map((option) => (
                        <DropdownMenuItem
                          key={option}
                          onClick={() => {
                            if (sortBy === option) {
                              setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setSortBy(option);
                              setSortOrder("desc");
                            }
                          }}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                          {sortBy === option && (
                            sortOrder === "asc" ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Sort signals by different criteria</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings2 className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>View Options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}>
                        {viewMode === "cards" ? "Switch to Table" : "Switch to Cards"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowAnalytics(!showAnalytics)}>
                        {showAnalytics ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Hide Analytics
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Show Analytics
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowInsights(!showInsights)}>
                        {showInsights ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Hide Insights
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Show AI Insights
                          </>
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Bar */}
          <Card className="lg:hidden">
            <CardContent className="py-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-muted-foreground">Total: </span>
                    <span className="font-medium">{sortedSignals.length}</span>
                  </div>
                  {analytics && (
                    <>
                      <div>
                        <span className="text-muted-foreground">High Risk: </span>
                        <span className="font-medium text-destructive">{analytics.highRisk}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Unclustered: </span>
                        <span className="font-medium text-orange-600">{analytics.unclustered}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters */}
          <Card data-guide="signals-filters">
            <CardContent className="pt-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="relative">
                  <Input
                    data-guide="search-bar"
                    placeholder={searchMode === "semantic" ? "Semantic search..." : "Search signals..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setSearchMode(searchMode === "standard" ? "semantic" : "standard")}
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{searchMode === "standard" ? "Switch to Semantic Search" : "Switch to Standard Search"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger data-guide="source-filter">
                  <SelectValue placeholder="Source Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="reddit">Reddit</SelectItem>
                  <SelectItem value="twitter">Twitter/X</SelectItem>
                  <SelectItem value="reviews">Reviews</SelectItem>
                  <SelectItem value="support">Support Tickets</SelectItem>
                  <SelectItem value="news">News</SelectItem>
                  <SelectItem value="forums">Forums</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger data-guide="severity-filter">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={languageFilter} onValueChange={setLanguageFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
                <SelectTrigger data-guide="timeframe-filter">
                  <SelectValue placeholder="Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Insights & Recommendations */}
        {showInsights && insights && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Insights & Recommendations
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowInsights(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {insights.summary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Recent Signals</div>
                      <div className="text-lg font-bold">{insights.summary.totalRecent}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">High Risk</div>
                      <div className="text-lg font-bold text-destructive">{insights.summary.highRisk}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Unclustered</div>
                      <div className="text-lg font-bold text-orange-600">{insights.summary.unclustered}</div>
                    </div>
                  </div>
                  {insights.recommendations && insights.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Recommended Actions:</div>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        {insights.recommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Connection Status & Source Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>System Status</span>
              <div className="flex items-center gap-2" data-guide="connection-status">
                <div className={`size-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          {sourceHealth.length > 0 && (
            <CardContent data-guide="source-health">
              <div className="flex flex-wrap gap-2">
                {sourceHealth.map(source => (
                  <div key={source.source_type} className="flex items-center gap-2">
                    {getSourceHealthIcon(source.status)}
                    <span className="text-sm">{source.source_type}</span>
                    <Badge variant={source.status === "healthy" ? "default" : "secondary"}>
                      {source.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Signals List */}
        {viewMode === "table" ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedSignals.size > 0 && selectedSignals.size === sortedSignals.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Amplification</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSignals.map((signal) => (
                    <TableRow
                      key={signal.evidence_id}
                      className="cursor-pointer"
                      onClick={() => setSelectedSignal(signal)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedSignals.has(signal.evidence_id)}
                        onCheckedChange={() => handleSelectSignal(signal.evidence_id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{signal.source.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md truncate">
                          {signal.content.normalized || signal.content.raw || "No content"}
                        </div>
                      </TableCell>
                      <TableCell>
                        {signal.metadata?.severity && (
                          <SeverityBadge severity={signal.metadata.severity} />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {getAmplificationScore(signal.evidence_id).toFixed(1)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedSignal(signal)}>
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleMarkHighRisk(signal.evidence_id, !(signal.metadata as any)?.high_risk)}
                            >
                              {(signal.metadata as any)?.high_risk ? "Remove High-Risk" : "Mark High-Risk"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLinkDialogOpen(signal.evidence_id)}>
                              Link to Cluster
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCreateCluster(signal.evidence_id)}>
                              Create Cluster
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            {totalPages > 1 && (
              <CardContent className="border-t">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedSignals.length)} of {sortedSignals.length} signals
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <div className="text-sm">
                      Page {page} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {paginatedSignals.map((signal) => (
              <Card
                key={signal.evidence_id}
                data-guide="signal-card"
                className={`cursor-pointer hover:bg-accent transition-colors ${
                  selectedSignals.has(signal.evidence_id) ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedSignal(signal)}
              >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedSignals.has(signal.evidence_id)}
                        onCheckedChange={() => handleSelectSignal(signal.evidence_id)}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Radio className="size-4 text-muted-foreground" />
                        <CardTitle className="text-base">{signal.source.type}</CardTitle>
                        <Badge variant="outline">{signal.type}</Badge>
                      {signal.metadata?.severity && (
                        <SeverityBadge severity={signal.metadata.severity} />
                      )}
                      {signal.metadata?.suggested_cluster_id && (
                        <Badge variant="outline" className="gap-1" data-guide="ai-suggestions">
                          <Sparkles className="h-3 w-3" />
                          Suggested Cluster
                        </Badge>
                      )}
                      {signal.metadata?.dedup_likely && (
                        <Badge variant="secondary">Dedup Likely</Badge>
                      )}
                    </div>
                    <CardDescription className="mt-2 line-clamp-2">
                      {signal.content.normalized || signal.content.raw || "No content"}
                    </CardDescription>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(signal.created_at), { addSuffix: true })}
                      </div>
                      {getAmplificationScore(signal.evidence_id) > 0 && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Amp: {getAmplificationScore(signal.evidence_id).toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link2 className="size-3" />
                <span className="font-mono text-xs">{signal.evidence_id}</span>
              </div>
              <div className="flex gap-2">
                <Dialog open={linkDialogOpen === signal.evidence_id} onOpenChange={(open) => {
                  if (!open) {
                    setLinkDialogOpen(null);
                    setSelectedCluster("");
                  } else {
                    setLinkDialogOpen(signal.evidence_id);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={processing[signal.evidence_id]} data-guide="link-cluster">
                      Link to cluster
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Link Signal to Cluster</DialogTitle>
                      <DialogDescription>
                        Select a cluster to link this signal to
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Select value={selectedCluster} onValueChange={setSelectedCluster}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a cluster" />
                        </SelectTrigger>
                        <SelectContent>
                          {clusters.map((cluster) => (
                            <SelectItem key={cluster.id} value={cluster.id}>
                              {cluster.primary_claim.substring(0, 60)}...
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setLinkDialogOpen(null);
                            setSelectedCluster("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => handleLinkToCluster(signal.evidence_id)}
                          disabled={!selectedCluster || processing[signal.evidence_id]}
                        >
                          Link
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCreateCluster(signal.evidence_id)}
                  disabled={processing[signal.evidence_id]}
                  data-guide="create-cluster"
                >
                  Create cluster
                </Button>
                <Button
                  size="sm"
                  variant={(signal.metadata as any)?.high_risk ? "destructive" : "outline"}
                  onClick={() =>
                    handleMarkHighRisk(
                      signal.evidence_id,
                      !(signal.metadata as any)?.high_risk
                    )
                  }
                  disabled={processing[signal.evidence_id]}
                  data-guide="mark-high-risk"
                >
                  {(signal.metadata as any)?.high_risk ? (
                    <>
                      <AlertTriangle className="mr-1 size-3" />
                      High-risk
                    </>
                  ) : (
                    "Mark high-risk"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          </Card>
      ))}
            {totalPages > 1 && (
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedSignals.length)} of {sortedSignals.length} signals
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <div className="text-sm">
                        Page {page} of {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>

        {/* Evidence Drawer (Right Side on Desktop) */}
        {selectedSignal && (
          <Sheet open={!!selectedSignal} onOpenChange={(open) => !open && setSelectedSignal(null)}>
            <SheetContent className="w-full sm:w-[400px] lg:w-[500px]">
            <SheetHeader>
              <SheetTitle>Signal Details</SheetTitle>
              <SheetDescription>
                Evidence ID: {selectedSignal.evidence_id.substring(0, 16)}...
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="h-[calc(100vh-120px)] mt-6">
              <Tabs defaultValue="normalized" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                  <TabsTrigger value="normalized">Normalized</TabsTrigger>
                  <TabsTrigger value="claims">Claims</TabsTrigger>
                  <TabsTrigger value="evidence">Evidence</TabsTrigger>
                  <TabsTrigger value="insights" className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Insights
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="raw" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Raw Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs whitespace-pre-wrap bg-muted p-3 rounded">
                        {selectedSignal.content.raw || "No raw content"}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedSignal.content.raw || "");
                          toast.success("Copied to clipboard");
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="normalized" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Normalized Content</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">
                        {selectedSignal.content.normalized || selectedSignal.content.raw || "No normalized content"}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="claims" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Extracted Claims</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedSignal.metadata?.extracted_claims && selectedSignal.metadata.extracted_claims.length > 0 ? (
                        <div className="space-y-2">
                          {selectedSignal.metadata.extracted_claims.map((claim, idx) => (
                            <div key={idx} className="p-2 border rounded">
                              <p className="text-sm">{claim.text}</p>
                              <Badge variant="outline" className="mt-1">
                                Confidence: {(claim.confidence * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No claims extracted</p>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="evidence" className="space-y-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Evidence Attachments</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4" />
                          <span className="text-sm">Source URL</span>
                        </div>
                        {selectedSignal.source.url ? (
                          <a
                            href={selectedSignal.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline break-all"
                          >
                            {selectedSignal.source.url}
                          </a>
                        ) : (
                          <p className="text-sm text-muted-foreground">No source URL</p>
                        )}
                        <div className="mt-4">
                          <EvidenceLink evidenceId={selectedSignal.evidence_id} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="insights" className="space-y-4 mt-4">
                  <SignalInsightsTab 
                    signal={selectedSignal} 
                    onLinkCluster={(clusterId) => {
                      setSelectedCluster(clusterId);
                      setLinkDialogOpen(selectedSignal.evidence_id);
                    }}
                  />
                </TabsContent>
              </Tabs>

              {/* Actions */}
              <div className="mt-6 space-y-2">
                {selectedSignal.metadata?.suggested_cluster_id && (
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/claims/${selectedSignal.metadata?.suggested_cluster_id || ""}`)}
                  >
                    Link to Suggested Cluster
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setLinkDialogOpen(selectedSignal.evidence_id);
                    setSelectedSignal(null);
                  }}
                >
                  Link to Cluster
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleMarkHighRisk(selectedSignal.evidence_id, !selectedSignal.metadata?.high_risk)}
                >
                  {selectedSignal.metadata?.high_risk ? "Remove High-Risk" : "Mark High-Risk"}
                </Button>
              </div>
            </ScrollArea>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </div>
  );
}
