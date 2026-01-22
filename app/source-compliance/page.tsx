/**
 * Source Compliance Page
 * Manage source policies and compliance checks
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import {
  Shield,
  Plus,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Settings,
} from "lucide-react";

interface SourcePolicy {
  id: string;
  source_type: string;
  allowed_sources: string[];
  collection_method: string;
  retention: {
    days: number;
    auto_delete: boolean;
  };
  compliance_flags: string[];
}

export default function SourceCompliancePage() {
  const [policies, setPolicies] = useState<SourcePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPolicy, setNewPolicy] = useState({
    source_type: "",
    allowed_sources: "",
    collection_method: "SCRAPE",
    retention_days: 90,
    auto_delete: false,
  });

  useEffect(() => {
    loadPolicies();
  }, []);

  async function loadPolicies() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/compliance/source-policies");
      if (!response.ok) {
        throw new Error("Failed to load policies");
      }
      const data = await response.json();
      setPolicies(data.policies || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePolicy() {
    try {
      const response = await fetch("/api/compliance/source-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: newPolicy.source_type,
          allowed_sources: newPolicy.allowed_sources.split(",").map((s) => s.trim()).filter(Boolean),
          collection_method: newPolicy.collection_method,
          retention: {
            days: newPolicy.retention_days,
            auto_delete: newPolicy.auto_delete,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create policy");
      }

      setDialogOpen(false);
      setNewPolicy({
        source_type: "",
        allowed_sources: "",
        collection_method: "SCRAPE",
        retention_days: 90,
        auto_delete: false,
      });
      loadPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create policy");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Source Compliance</h1>
            <p className="text-muted-foreground mt-1">
              Manage source policies and compliance checks for signal ingestion
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadPolicies} variant="outline" size="sm">
              <RefreshCw className="mr-2 size-4" />
              Refresh
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" />
                  New Policy
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Source Policy</DialogTitle>
                  <DialogDescription>
                    Define compliance rules for a specific source type
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="source_type">Source Type</Label>
                    <Input
                      id="source_type"
                      placeholder="e.g., TWITTER, REDDIT, NEWS"
                      value={newPolicy.source_type}
                      onChange={(e) => setNewPolicy({ ...newPolicy, source_type: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="allowed_sources">Allowed Sources (comma-separated)</Label>
                    <Input
                      id="allowed_sources"
                      placeholder="e.g., twitter.com, reddit.com or * for all"
                      value={newPolicy.allowed_sources}
                      onChange={(e) => setNewPolicy({ ...newPolicy, allowed_sources: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="collection_method">Collection Method</Label>
                    <Select
                      value={newPolicy.collection_method}
                      onValueChange={(value) => setNewPolicy({ ...newPolicy, collection_method: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SCRAPE">Scrape</SelectItem>
                        <SelectItem value="API">API</SelectItem>
                        <SelectItem value="RSS">RSS</SelectItem>
                        <SelectItem value="WEBHOOK">Webhook</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="retention_days">Retention (days)</Label>
                    <Input
                      id="retention_days"
                      type="number"
                      value={newPolicy.retention_days}
                      onChange={(e) => setNewPolicy({ ...newPolicy, retention_days: parseInt(e.target.value) || 90 })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto_delete"
                      checked={newPolicy.auto_delete}
                      onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, auto_delete: checked })}
                    />
                    <Label htmlFor="auto_delete">Auto-delete after retention period</Label>
                  </div>
                  <Button onClick={handleCreatePolicy} className="w-full">
                    Create Policy
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Source Policies</CardTitle>
            <CardDescription>
              Policies define which sources are allowed and how they should be collected
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : policies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source Type</TableHead>
                    <TableHead>Allowed Sources</TableHead>
                    <TableHead>Collection Method</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Auto-Delete</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <Badge variant="outline">{policy.source_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md">
                          {policy.allowed_sources.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {policy.allowed_sources.slice(0, 3).map((source, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {source}
                                </Badge>
                              ))}
                              {policy.allowed_sources.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{policy.allowed_sources.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{policy.collection_method}</Badge>
                      </TableCell>
                      <TableCell>{policy.retention.days} days</TableCell>
                      <TableCell>
                        {policy.retention.auto_delete ? (
                          <CheckCircle2 className="size-4 text-green-600" />
                        ) : (
                          <XCircle className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="size-3" />
                          Active
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 text-center">
                <Shield className="mx-auto size-12 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No policies configured. Create a policy to define source compliance rules.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
