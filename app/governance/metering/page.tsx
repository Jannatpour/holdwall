"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { BarChart3, TrendingUp, AlertTriangle, Settings, Save } from "lucide-react";
import { toast } from "sonner";

interface Entitlement {
  id: string;
  metric: string;
  softLimit: number;
  hardLimit: number;
  currentUsage: number;
  enforcement: "SOFT" | "HARD" | "NONE";
}

export default function MeteringDashboardPage() {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntitlement, setEditingEntitlement] = useState<Entitlement | null>(null);
  const [formData, setFormData] = useState<Partial<Entitlement>>({
    metric: "",
    softLimit: 1000,
    hardLimit: 2000,
    enforcement: "SOFT",
  });

  useEffect(() => {
    loadEntitlements();
  }, []);

  async function loadEntitlements() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/governance/metering");
      if (!response.ok) {
        throw new Error("Failed to load entitlements");
      }
      const data = await response.json();
      setEntitlements(data.entitlements || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load entitlements");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      const url = editingEntitlement
        ? `/api/governance/metering/${editingEntitlement.id}`
        : "/api/governance/metering";
      const method = editingEntitlement ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save entitlement");
      }

      toast.success(editingEntitlement ? "Entitlement updated" : "Entitlement created");
      setDialogOpen(false);
      setEditingEntitlement(null);
      setFormData({
        metric: "",
        softLimit: 1000,
        hardLimit: 2000,
        enforcement: "SOFT",
      });
      loadEntitlements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save entitlement");
    }
  }

  function getUsagePercentage(entitlement: Entitlement): number {
    return Math.min(100, (entitlement.currentUsage / entitlement.hardLimit) * 100);
  }

  function getUsageColor(entitlement: Entitlement): string {
    const percentage = getUsagePercentage(entitlement);
    if (percentage >= 90) return "text-destructive";
    if (percentage >= 75) return "text-orange-600";
    return "text-green-600";
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Metering & Entitlements</h1>
            <p className="text-muted-foreground">
              Monitor usage, configure limits, and manage enforcement
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingEntitlement(null);
                setFormData({
                  metric: "",
                  softLimit: 1000,
                  hardLimit: 2000,
                  enforcement: "SOFT",
                });
              }}>
                <Settings className="mr-2 size-4" />
                Configure Entitlement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingEntitlement ? "Edit Entitlement" : "Create Entitlement"}
                </DialogTitle>
                <DialogDescription>
                  Configure usage limits and enforcement mode
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="metric">Metric</Label>
                  <Select
                    value={formData.metric}
                    onValueChange={(value) => setFormData({ ...formData, metric: value })}
                    disabled={!!editingEntitlement}
                  >
                    <SelectTrigger id="metric">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="events_ingested_per_day">Events Ingested/Day</SelectItem>
                      <SelectItem value="agent_runs_per_day">Agent Runs/Day</SelectItem>
                      <SelectItem value="artifacts_published_per_month">Artifacts Published/Month</SelectItem>
                      <SelectItem value="alerts_sent_per_month">Alerts Sent/Month</SelectItem>
                      <SelectItem value="retention_window_days">Retention Window (Days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="soft-limit">Soft Limit</Label>
                  <Input
                    id="soft-limit"
                    type="number"
                    value={formData.softLimit || 1000}
                    onChange={(e) => setFormData({ ...formData, softLimit: parseInt(e.target.value) || 1000 })}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Warning threshold - alerts will be sent when exceeded
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hard-limit">Hard Limit</Label>
                  <Input
                    id="hard-limit"
                    type="number"
                    value={formData.hardLimit || 2000}
                    onChange={(e) => setFormData({ ...formData, hardLimit: parseInt(e.target.value) || 2000 })}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum allowed - non-critical tasks will be blocked when exceeded
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enforcement">Enforcement Mode</Label>
                  <Select
                    value={formData.enforcement}
                    onValueChange={(value: any) => setFormData({ ...formData, enforcement: value })}
                  >
                    <SelectTrigger id="enforcement">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None (Monitoring Only)</SelectItem>
                      <SelectItem value="SOFT">Soft (Warnings Only)</SelectItem>
                      <SelectItem value="HARD">Hard (Block Non-Critical)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="mr-2 size-4" />
                  {editingEntitlement ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">Loading entitlements...</div>
            </CardContent>
          </Card>
        ) : entitlements.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4 py-8">
                <p className="text-muted-foreground">No entitlements configured</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Settings className="mr-2 size-4" />
                  Create First Entitlement
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {entitlements.map((entitlement) => {
              const usagePercent = getUsagePercentage(entitlement);
              const isOverSoft = entitlement.currentUsage >= entitlement.softLimit;
              const isOverHard = entitlement.currentUsage >= entitlement.hardLimit;

              return (
                <Card key={entitlement.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{entitlement.metric.replace(/_/g, " ")}</CardTitle>
                      <Badge variant={isOverHard ? "destructive" : isOverSoft ? "default" : "outline"}>
                        {entitlement.enforcement}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Usage</span>
                        <span className={`font-semibold ${getUsageColor(entitlement)}`}>
                          {entitlement.currentUsage.toLocaleString()} / {entitlement.hardLimit.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={usagePercent} className="h-2" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>Soft: {entitlement.softLimit.toLocaleString()}</span>
                        <span>{usagePercent.toFixed(1)}%</span>
                      </div>
                    </div>

                    {isOverSoft && (
                      <Alert variant={isOverHard ? "destructive" : "default"}>
                        <AlertTriangle className="size-4" />
                        <AlertDescription>
                          {isOverHard
                            ? "Hard limit exceeded - non-critical tasks blocked"
                            : "Soft limit exceeded - consider upgrading"}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setEditingEntitlement(entitlement);
                        setFormData({
                          metric: entitlement.metric,
                          softLimit: entitlement.softLimit,
                          hardLimit: entitlement.hardLimit,
                          enforcement: entitlement.enforcement,
                        });
                        setDialogOpen(true);
                      }}
                    >
                      <Settings className="mr-2 size-4" />
                      Configure
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
