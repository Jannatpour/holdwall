"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, Globe, Info, Settings, Zap } from "lucide-react";
import { toast } from "sonner";

type AutopilotModeId = "recommend_only" | "auto_draft" | "auto_route" | "auto_publish";

const modeLabels: Record<AutopilotModeId, string> = {
  recommend_only: "Recommend only",
  auto_draft: "Auto-draft",
  auto_route: "Auto-route",
  auto_publish: "Auto-publish",
};

interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  mode: AutopilotModeId;
  enabled: boolean;
}

export function AutopilotControls() {
  const { status } = useSession();
  const [workflows, setWorkflows] = React.useState<WorkflowConfig[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [savingWorkflowId, setSavingWorkflowId] = React.useState<string | null>(null);

  const fetchWorkflows = React.useCallback(async () => {
    if (status === "unauthenticated") {
      window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    if (status === "loading") {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/governance/autopilot", { cache: "no-store", credentials: "include" });
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        throw new Error(`Failed to fetch autopilot configs: ${response.statusText}`);
      }
      const data = await response.json();
      setWorkflows(Array.isArray(data.workflows) ? data.workflows : []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load autopilot configs");
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchWorkflows();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchWorkflows]);

  const updateWorkflow = async (workflowId: string, patch: { enabled?: boolean; mode?: AutopilotModeId }) => {
    const current = workflows.find((w) => w.id === workflowId);
    if (!current) return;

    const next: WorkflowConfig = {
      ...current,
      enabled: patch.enabled ?? current.enabled,
      mode: patch.mode ?? current.mode,
    };

    setSavingWorkflowId(workflowId);
    try {
      const response = await fetch("/api/governance/autopilot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow_id: workflowId,
          mode: next.mode,
          enabled: next.enabled,
        }),
      });

      if (!response.ok) {
        const msg = await response.text().catch(() => "");
        throw new Error(msg || "Failed to update autopilot config");
      }

      setWorkflows((prev) => prev.map((w) => (w.id === workflowId ? next : w)));
      toast.success("Autopilot updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update autopilot");
    } finally {
      setSavingWorkflowId(null);
    }
  };

  const enabledCount = workflows.filter((w) => w.enabled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="size-5" />
              Autopilot Controls
            </CardTitle>
            <CardDescription>Configure automation mode per playbook</CardDescription>
          </div>
          <Badge variant={enabledCount > 0 ? "default" : "secondary"}>
            {enabledCount} enabled
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {enabledCount > 0 && (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              {enabledCount} playbook{enabledCount === 1 ? "" : "s"} enabled for autopilot.
              Ensure approvals and policies are configured for automated actions.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground text-center">
              Loading autopilot controls…
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-lg border p-4 text-sm text-muted-foreground text-center">
              No workflows configured. Create a playbook to configure autopilot controls.
            </div>
          ) : (
            workflows.map((wf, idx) => (
              <div key={wf.id} className="space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-1 ${wf.enabled ? "text-primary" : "text-muted-foreground"}`}>
                      {wf.mode === "auto_publish" ? (
                        <Globe className="size-5" />
                      ) : wf.mode === "recommend_only" ? (
                        <Info className="size-5" />
                      ) : (
                        <Settings className="size-5" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={wf.id} className="text-base font-semibold">
                          {wf.name}
                        </Label>
                        {wf.enabled ? (
                          <Badge variant="default" className="text-xs">
                            Enabled
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{wf.description || "No description"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Select
                      value={wf.mode}
                      onValueChange={(value) => updateWorkflow(wf.id, { mode: value as AutopilotModeId })}
                      disabled={!wf.enabled || savingWorkflowId === wf.id}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recommend_only">{modeLabels.recommend_only}</SelectItem>
                        <SelectItem value="auto_draft">{modeLabels.auto_draft}</SelectItem>
                        <SelectItem value="auto_route">{modeLabels.auto_route}</SelectItem>
                        <SelectItem value="auto_publish">{modeLabels.auto_publish}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Switch
                      id={wf.id}
                      checked={wf.enabled}
                      disabled={savingWorkflowId === wf.id}
                      onCheckedChange={(checked) => updateWorkflow(wf.id, { enabled: checked })}
                    />
                  </div>
                </div>

                {idx !== workflows.length - 1 && <Separator />}
              </div>
            ))
          )}
        </div>

        <Alert>
          <Info className="size-4" />
          <AlertDescription className="text-sm">
            <strong>How it works:</strong> Each playbook selects one autopilot mode, describing how far automation can
            proceed (recommend → draft → route → publish). Enable a playbook only when its approvals and policies are
            in place.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={fetchWorkflows} disabled={loading}>
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              // Disable all workflows in a best-effort loop.
              for (const wf of workflows) {
                if (wf.enabled) {
                  // eslint-disable-next-line no-await-in-loop
                  await updateWorkflow(wf.id, { enabled: false, mode: "recommend_only" });
                }
              }
              toast.info("Disabled all autopilot workflows");
            }}
            disabled={loading || workflows.length === 0}
          >
            Disable all
          </Button>
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            <span>Audit logging enforced on changes</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
