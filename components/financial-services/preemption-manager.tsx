"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Zap,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Plus,
  Settings,
  TrendingUp,
} from "lucide-react";

interface PreemptionPlaybook {
  id: string;
  name: string;
  category: string;
  triggerConditions: {
    signalDrift?: number;
    forecastProbability?: number;
    velocityThreshold?: number;
    sentimentThreshold?: number;
  };
  preemptiveActions: Array<{
    type: string;
    content: string;
    publishTiming: string;
  }>;
  enabled: boolean;
}

interface PlaybookTrigger {
  playbook: PreemptionPlaybook;
  triggered: boolean;
  reason: string;
}

export function FinancialServicesPreemptionManager() {
  const [playbooks, setPlaybooks] = React.useState<PreemptionPlaybook[]>([]);
  const [triggers, setTriggers] = React.useState<PlaybookTrigger[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [executing, setExecuting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchPlaybooks = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/financial-services/preemption");
      if (!response.ok) {
        throw new Error("Failed to fetch preemption playbooks");
      }
      const data = await response.json();
      setPlaybooks(data.playbooks || []);
      setTriggers(data.triggers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchPlaybooks();
    const interval = setInterval(fetchPlaybooks, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchPlaybooks]);

  const handleCreateDefaults = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/financial-services/preemption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_defaults" }),
      });

      if (!response.ok) {
        throw new Error("Failed to create default playbooks");
      }

      await fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (playbookId: string) => {
    try {
      setExecuting(playbookId);
      const response = await fetch("/api/financial-services/preemption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          playbookId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute playbook");
      }

      await fetchPlaybooks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(null);
    }
  };

  if (loading && playbooks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Preemption Playbooks</CardTitle>
          <CardDescription>Loading playbooks...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const triggeredPlaybooks = triggers.filter((t) => t.triggered);

  return (
    <div className="space-y-6">
      {/* Strategic Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Zap className="h-6 w-6 text-primary" />
                Predictive Preemption Engine
              </CardTitle>
              <CardDescription className="text-base">
                Stop narrative outbreaks before they start with AI-powered early signal drift detection and automated response
              </CardDescription>
            </div>
            {playbooks.length === 0 && (
              <Button onClick={handleCreateDefaults} disabled={loading}>
                <Plus className="mr-2 h-4 w-4" />
                Create Default Playbooks
              </Button>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Triggered Playbooks Alert */}
      {triggeredPlaybooks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{triggeredPlaybooks.length} Playbook(s) Triggered</AlertTitle>
          <AlertDescription>
            {triggeredPlaybooks.map((t) => t.playbook.name).join(", ")} require immediate action.
          </AlertDescription>
        </Alert>
      )}

      {/* Playbooks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Playbooks</CardTitle>
          <CardDescription>
            {playbooks.length} playbook(s) configured for financial narrative categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          {playbooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No preemption playbooks configured</p>
              <p className="text-sm mt-2">
                Create default playbooks to enable predictive narrative management
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Trigger Conditions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {playbooks.map((playbook) => {
                  const trigger = triggers.find((t) => t.playbook.id === playbook.id);
                  return (
                    <TableRow key={playbook.id}>
                      <TableCell className="font-medium">{playbook.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{playbook.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {playbook.triggerConditions.forecastProbability && (
                            <div>
                              Forecast: {(playbook.triggerConditions.forecastProbability * 100).toFixed(0)}%
                            </div>
                          )}
                          {playbook.triggerConditions.signalDrift && (
                            <div>
                              Drift: {playbook.triggerConditions.signalDrift.toFixed(2)}
                            </div>
                          )}
                          {playbook.triggerConditions.velocityThreshold && (
                            <div>Velocity: {playbook.triggerConditions.velocityThreshold}/hr</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {trigger?.triggered ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Triggered
                          </Badge>
                        ) : playbook.enabled ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {trigger?.triggered && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleExecute(playbook.id)}
                              disabled={executing === playbook.id}
                            >
                              {executing === playbook.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Play className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <Settings className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Trigger Details */}
      {triggers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trigger Status</CardTitle>
            <CardDescription>Current trigger conditions and status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {triggers.map((trigger, idx) => (
                <Alert
                  key={idx}
                  variant={trigger.triggered ? "destructive" : "default"}
                >
                  <TrendingUp className="h-4 w-4" />
                  <AlertTitle>{trigger.playbook.name}</AlertTitle>
                  <AlertDescription>
                    {trigger.triggered ? (
                      <span className="font-semibold">Triggered: {trigger.reason}</span>
                    ) : (
                      <span className="text-muted-foreground">No triggers: {trigger.reason}</span>
                    )}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
