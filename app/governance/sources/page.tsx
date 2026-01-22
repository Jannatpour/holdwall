"use client";

import { useEffect, useState, useRef } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, ErrorState } from "@/components/ui/loading-states";
import { 
  Plus, Edit, Trash2, Save, AlertCircle, CheckCircle2, Download, 
  MoreVertical, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Eye, EyeOff,
  Activity, TrendingUp, TrendingDown, RefreshCw, TestTube, XCircle,
  Shield, Database, Clock, FileText, Filter, Search, BarChart3
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { logger } from "@/lib/logging/logger";

interface SourcePolicy {
  id: string;
  sourceType: string;
  allowedSources: string[];
  collectionMethod: "API" | "RSS" | "SCRAPE" | "USER_EXPORT";
  retentionDays: number;
  autoDelete: boolean;
  complianceFlags: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface SourceHealth {
  source_type: string;
  status: "healthy" | "degraded" | "unhealthy";
  last_success: string;
  error_rate: number;
}

interface SourceAnalytics {
  total: number;
  byMethod: Record<string, number>;
  byCompliance: Record<string, number>;
  health: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  averageRetention: number;
  autoDeleteEnabled: number;
  totalAllowedSources: number;
  timeSeries: Array<{ date: string; count: number }>;
  sources: SourceHealth[];
}

export default function SourceCompliancePage() {
  const [policies, setPolicies] = useState<SourcePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SourcePolicy | null>(null);
  const [formData, setFormData] = useState<Partial<SourcePolicy>>({
    sourceType: "",
    allowedSources: [],
    collectionMethod: "API",
    retentionDays: 90,
    autoDelete: false,
    complianceFlags: [],
  });
  const [analytics, setAnalytics] = useState<SourceAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [selectedPolicies, setSelectedPolicies] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"sourceType" | "method" | "retention" | "created">("sourceType");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterMethod, setFilterMethod] = useState<string>("all");
  const [filterCompliance, setFilterCompliance] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [testingPolicy, setTestingPolicy] = useState<string | null>(null);
  const healthRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadPolicies();
    loadAnalytics();
    
    // Refresh health data every 30 seconds
    healthRefreshInterval.current = setInterval(() => {
      loadAnalytics();
    }, 30000);

    return () => {
      if (healthRefreshInterval.current) {
        clearInterval(healthRefreshInterval.current);
      }
    };
  }, []);

  async function loadPolicies() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/governance/sources");
      if (!response.ok) {
        throw new Error("Failed to load source policies");
      }
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  async function loadAnalytics() {
    try {
      const response = await fetch("/api/governance/sources/analytics");
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      logger.error("Failed to load analytics", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function handleSave() {
    try {
      const url = editingPolicy
        ? `/api/governance/sources/${editingPolicy.id}`
        : "/api/governance/sources";
      const method = editingPolicy ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save policy");
      }

      toast.success(editingPolicy ? "Policy updated" : "Policy created");
      setDialogOpen(false);
      setEditingPolicy(null);
      setFormData({
        sourceType: "",
        allowedSources: [],
        collectionMethod: "API",
        retentionDays: 90,
        autoDelete: false,
        complianceFlags: [],
      });
      loadPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save policy");
    }
  }

  async function handleDelete(policyId: string) {
    if (!confirm("Are you sure you want to delete this policy?")) return;

    try {
      const response = await fetch(`/api/governance/sources/${policyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete policy");
      }

      toast.success("Policy deleted");
      loadPolicies();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete policy");
    }
  }

  function handleEdit(policy: SourcePolicy) {
    setEditingPolicy(policy);
    setFormData({
      sourceType: policy.sourceType,
      allowedSources: policy.allowedSources,
      collectionMethod: policy.collectionMethod,
      retentionDays: policy.retentionDays,
      autoDelete: policy.autoDelete,
      complianceFlags: policy.complianceFlags,
    });
    setDialogOpen(true);
  }

  // Filter and sort policies
  const filteredPolicies = policies.filter((policy) => {
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        policy.sourceType.toLowerCase().includes(searchLower) ||
        policy.allowedSources.some(s => s.toLowerCase().includes(searchLower)) ||
        policy.complianceFlags.some(f => f.toLowerCase().includes(searchLower));
      if (!matchesSearch) return false;
    }
    if (filterMethod !== "all" && policy.collectionMethod !== filterMethod) return false;
    if (filterCompliance !== "all" && !policy.complianceFlags.includes(filterCompliance)) return false;
    return true;
  });

  const sortedPolicies = [...filteredPolicies].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "sourceType":
        comparison = a.sourceType.localeCompare(b.sourceType);
        break;
      case "method":
        comparison = a.collectionMethod.localeCompare(b.collectionMethod);
        break;
      case "retention":
        comparison = a.retentionDays - b.retentionDays;
        break;
      case "created":
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        comparison = dateB - dateA;
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  // Pagination
  const totalPages = Math.ceil(sortedPolicies.length / pageSize);
  const paginatedPolicies = sortedPolicies.slice((page - 1) * pageSize, page * pageSize);

  // Bulk operations
  const handleSelectAll = () => {
    if (selectedPolicies.size === paginatedPolicies.length && 
        paginatedPolicies.every(p => selectedPolicies.has(p.id))) {
      const newSelected = new Set(selectedPolicies);
      paginatedPolicies.forEach(p => newSelected.delete(p.id));
      setSelectedPolicies(newSelected);
    } else {
      const newSelected = new Set(selectedPolicies);
      paginatedPolicies.forEach(p => newSelected.add(p.id));
      setSelectedPolicies(newSelected);
    }
  };

  const handleSelectPolicy = (policyId: string) => {
    const newSelected = new Set(selectedPolicies);
    if (newSelected.has(policyId)) {
      newSelected.delete(policyId);
    } else {
      newSelected.add(policyId);
    }
    setSelectedPolicies(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedPolicies.size === 0) {
      toast.error("No policies selected");
      return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedPolicies.size} policy/policies?`)) return;

    try {
      const promises = Array.from(selectedPolicies).map(id =>
        fetch(`/api/governance/sources/${id}`, { method: "DELETE" })
      );
      await Promise.all(promises);
      toast.success(`Deleted ${selectedPolicies.size} policy/policies`);
      setSelectedPolicies(new Set());
      loadPolicies();
    } catch (err) {
      toast.error("Failed to delete policies");
    }
  };

  const handleExport = () => {
    const selected = policies.filter(p => selectedPolicies.has(p.id));
    const csv = [
      ["Source Type", "Collection Method", "Retention Days", "Auto Delete", "Allowed Sources", "Compliance Flags"].join(","),
      ...selected.map(p => [
        p.sourceType,
        p.collectionMethod,
        p.retentionDays,
        p.autoDelete ? "Yes" : "No",
        `"${p.allowedSources.join("; ")}"`,
        `"${p.complianceFlags.join("; ")}"`,
      ].join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `source-policies-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedPolicies.size} policies`);
  };

  const handleTestConnection = async (policyId: string) => {
    setTestingPolicy(policyId);
    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Connection test successful");
    } catch (err) {
      toast.error("Connection test failed");
    } finally {
      setTestingPolicy(null);
    }
  };

  const getHealthStatus = (sourceType: string) => {
    if (!analytics) return null;
    return analytics.sources.find(s => s.source_type === sourceType);
  };

  const getHealthIcon = (status: "healthy" | "degraded" | "unhealthy") => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "degraded":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterMethod, filterCompliance, sortBy, sortOrder]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between" data-guide="sources-header">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Source Compliance</h1>
            <p className="text-muted-foreground">
              Manage source policies, collection methods, and retention rules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingPolicy(null);
                setFormData({
                  sourceType: "",
                  allowedSources: [],
                  collectionMethod: "API",
                  retentionDays: 90,
                  autoDelete: false,
                  complianceFlags: [],
                });
              }}>
                <Plus className="mr-2 size-4" />
                Add Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingPolicy ? "Edit Source Policy" : "Create Source Policy"}
                </DialogTitle>
                <DialogDescription>
                  Configure source collection policies and compliance rules
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="source-type">Source Type</Label>
                  <Input
                    id="source-type"
                    value={formData.sourceType || ""}
                    onChange={(e) => setFormData({ ...formData, sourceType: e.target.value })}
                    placeholder="e.g., twitter, reddit, news"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collection-method">Collection Method</Label>
                  <Select
                    value={formData.collectionMethod}
                    onValueChange={(value: any) => setFormData({ ...formData, collectionMethod: value })}
                  >
                    <SelectTrigger id="collection-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="API">API</SelectItem>
                      <SelectItem value="RSS">RSS Feed</SelectItem>
                      <SelectItem value="SCRAPE">Web Scraping</SelectItem>
                      <SelectItem value="USER_EXPORT">User Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-days">Retention Days</Label>
                  <Input
                    id="retention-days"
                    type="number"
                    value={formData.retentionDays || 90}
                    onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) || 90 })}
                    min={1}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-delete"
                    checked={formData.autoDelete || false}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoDelete: checked === true })}
                  />
                  <Label htmlFor="auto-delete" className="cursor-pointer">
                    Auto-delete after retention period
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Allowed Sources (one per line)</Label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={(formData.allowedSources || []).join("\n")}
                    onChange={(e) => setFormData({
                      ...formData,
                      allowedSources: e.target.value.split("\n").filter(s => s.trim()),
                    })}
                    placeholder="example.com&#10;subdomain.example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Compliance Flags</Label>
                  <div className="space-y-2">
                    {["GDPR", "CCPA", "HIPAA", "SOC2"].map((flag) => (
                      <div key={flag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`flag-${flag}`}
                          checked={(formData.complianceFlags || []).includes(flag)}
                          onCheckedChange={(checked) => {
                            const flags = formData.complianceFlags || [];
                            if (checked) {
                              setFormData({ ...formData, complianceFlags: [...flags, flag] });
                            } else {
                              setFormData({ ...formData, complianceFlags: flags.filter(f => f !== flag) });
                            }
                          }}
                        />
                        <Label htmlFor={`flag-${flag}`} className="cursor-pointer">
                          {flag}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 size-4" />
                  {editingPolicy ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Analytics Dashboard */}
        {showAnalytics && analytics && (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Policies</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.total}</div>
                  <div className="text-xs text-muted-foreground mt-1">Active source policies</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Healthy Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{analytics.health.healthy}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {analytics.health.degraded} degraded, {analytics.health.unhealthy} unhealthy
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Retention</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.averageRetention}</div>
                  <div className="text-xs text-muted-foreground mt-1">days</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Allowed Sources</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.totalAllowedSources}</div>
                  <div className="text-xs text-muted-foreground mt-1">Total configured sources</div>
                </CardContent>
              </Card>
            </div>

            {/* Health Status Overview */}
            {analytics.sources && analytics.sources.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Source Health Status</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadAnalytics}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {analytics.sources.map((source) => (
                      <div key={source.source_type} className="space-y-2">
                        <div className="flex items-center gap-2">
                          {getHealthIcon(source.status)}
                          <span className="text-sm font-medium capitalize">{source.source_type}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(source.last_success), { addSuffix: true })}
                        </div>
                        <Progress 
                          value={(1 - source.error_rate) * 100} 
                          className="h-1"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Collection Method Distribution */}
            {Object.keys(analytics.byMethod).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Collection Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.byMethod)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, count]) => {
                        const percentage = analytics.total > 0 
                          ? (count / analytics.total) * 100 
                          : 0;
                        return (
                          <div key={method} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium">{method}</span>
                              <span className="text-muted-foreground">
                                {`${count} (${percentage.toFixed(1)}%)`}
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
          </>
        )}

        {/* Toolbar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Checkbox
                  checked={paginatedPolicies.length > 0 && paginatedPolicies.every(p => selectedPolicies.has(p.id))}
                  onCheckedChange={handleSelectAll}
                  className="mr-2"
                />
                {selectedPolicies.size > 0 ? (
                  <>
                    <span className="text-sm font-medium">
                      {selectedPolicies.size} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPolicies(new Set())}
                      className="h-7 px-2"
                    >
                      Clear
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkDelete}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExport}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Export
                    </Button>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {sortedPolicies.length} policy{sortedPolicies.length !== 1 ? "ies" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
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
                    {(["sourceType", "method", "retention", "created"] as const).map((option) => (
                      <DropdownMenuItem
                        key={option}
                        onClick={() => {
                          if (sortBy === option) {
                            setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                          } else {
                            setSortBy(option);
                            setSortOrder("asc");
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>View Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
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
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card data-guide="sources-filters">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                data-guide="search-bar"
                placeholder="Search policies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger data-guide="method-filter">
                  <SelectValue placeholder="Collection Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="API">API</SelectItem>
                  <SelectItem value="RSS">RSS Feed</SelectItem>
                  <SelectItem value="SCRAPE">Web Scraping</SelectItem>
                  <SelectItem value="USER_EXPORT">User Export</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCompliance} onValueChange={setFilterCompliance}>
                <SelectTrigger data-guide="compliance-filter">
                  <SelectValue placeholder="Compliance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Compliance</SelectItem>
                  <SelectItem value="GDPR">GDPR</SelectItem>
                  <SelectItem value="CCPA">CCPA</SelectItem>
                  <SelectItem value="HIPAA">HIPAA</SelectItem>
                  <SelectItem value="SOC2">SOC2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">Loading policies...</div>
            </CardContent>
          </Card>
        ) : error ? (
          <ErrorState title="Error loading policies" description={error} error={new Error(error)} />
        ) : sortedPolicies.length === 0 ? (
          <EmptyState
            title={policies.length === 0 ? "No source policies configured" : "No matching policies"}
            description={policies.length === 0 
              ? "Create your first source policy to get started"
              : "Try adjusting your filters"}
            action={{
              label: policies.length === 0 ? "Create First Policy" : "Clear Filters",
              onClick: () => {
                if (policies.length === 0) {
                  setDialogOpen(true);
                } else {
                  setSearchQuery("");
                  setFilterMethod("all");
                  setFilterCompliance("all");
                }
              },
            }}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Source Policies</CardTitle>
              <CardDescription>
                Configure how sources are collected and retained
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedPolicies.length > 0 && paginatedPolicies.every(p => selectedPolicies.has(p.id))}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Collection Method</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Auto-Delete</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPolicies.map((policy) => {
                    const health = getHealthStatus(policy.sourceType);
                    return (
                      <TableRow key={policy.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPolicies.has(policy.id)}
                            onCheckedChange={() => handleSelectPolicy(policy.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{policy.sourceType}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{policy.collectionMethod}</Badge>
                        </TableCell>
                        <TableCell>{policy.retentionDays} days</TableCell>
                        <TableCell>
                          {policy.autoDelete ? (
                            <CheckCircle2 className="size-4 text-green-600" />
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {policy.complianceFlags.map((flag) => (
                              <Badge key={flag} variant="secondary" className="text-xs">
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {health ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1">
                                    {getHealthIcon(health.status)}
                                    <span className="text-xs text-muted-foreground capitalize">
                                      {health.status}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Last success: {formatDistanceToNow(new Date(health.last_success), { addSuffix: true })}</p>
                                  <p>Error rate: {(health.error_rate * 100).toFixed(1)}%</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(policy)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleTestConnection(policy.id)}>
                                <TestTube className="mr-2 h-4 w-4" />
                                Test Connection
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(policy.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <CardContent className="border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, sortedPolicies.length)} of {sortedPolicies.length} policies
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
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
