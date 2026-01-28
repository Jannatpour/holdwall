/**
 * Playbooks Data Component
 * 
 * Displays playbook catalog, active runs, and history
 */

"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Play, Clock, CheckCircle2, XCircle, AlertCircle, Edit, Trash2, MoreVertical } from "@/components/demo-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/loading-states";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

interface Playbook {
  id: string;
  name: string;
  description?: string;
  autopilotMode: "RECOMMEND_ONLY" | "AUTO_DRAFT" | "AUTO_ROUTE" | "AUTO_PUBLISH";
  executions?: PlaybookExecution[];
}

interface PlaybookExecution {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: string;
  completedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
  playbookName?: string;
}

interface PlaybooksDataProps {
  tab?: "catalog" | "active-runs" | "history";
  executionId?: string;
}

export function PlaybooksData({ tab = "catalog", executionId }: PlaybooksDataProps) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [activeRuns, setActiveRuns] = useState<PlaybookExecution[]>([]);
  const [allExecutions, setAllExecutions] = useState<PlaybookExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [running, setRunning] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<PlaybookExecution | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDeletePlaybook = async (playbookId: string) => {
    if (!confirm("Are you sure you want to delete this playbook? This action cannot be undone.")) {
      return;
    }

    setDeleting(playbookId);
    try {
      const response = await fetch(`/api/playbooks?id=${playbookId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete playbook");
      }

      toast.success("Playbook deleted successfully");
      // Refresh data
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete playbook");
    } finally {
      setDeleting(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadPlaybooks() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/playbooks");
        if (!response.ok) {
          throw new Error("Failed to load playbooks");
        }

        const data = await response.json();
        if (!cancelled) {
          setPlaybooks(Array.isArray(data) ? data : []);
          
          // Extract active runs and all executions
          const runs: PlaybookExecution[] = [];
          const executions: PlaybookExecution[] = [];
          for (const playbook of Array.isArray(data) ? data : []) {
            if (playbook.executions) {
              for (const exec of playbook.executions) {
                const execWithName = { ...exec, playbookName: playbook.name };
                executions.push(execWithName);
                if (exec.status === "RUNNING" || exec.status === "PENDING") {
                  runs.push(execWithName);
                }
              }
            }
          }
          setActiveRuns(runs);
          setAllExecutions(executions.sort((a, b) => 
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          ));
          
          // If executionId is provided, find and select it
          if (executionId) {
            const exec = executions.find(e => e.id === executionId);
            if (exec) {
              setSelectedExecution(exec);
            }
          }
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

    loadPlaybooks();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRunPlaybook = async (playbookId: string) => {
    setRunning(true);
    try {
      const response = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playbook_id: playbookId }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success("Playbook execution started");
        // Refresh data
        window.location.reload();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to run playbook");
      }
    } catch (err) {
      toast.error("Failed to run playbook");
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <LoadingState count={3} />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  // Show execution detail if selected
  if (selectedExecution && tab === "history") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setSelectedExecution(null)}>
          ← Back to History
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Execution Details</CardTitle>
            <CardDescription>Playbook: {selectedExecution.playbookName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Status</div>
              <Badge
                variant={
                  selectedExecution.status === "COMPLETED" ? "default" :
                  selectedExecution.status === "FAILED" ? "destructive" :
                  selectedExecution.status === "RUNNING" ? "secondary" : "outline"
                }
              >
                {selectedExecution.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Started</div>
              <div className="text-sm text-muted-foreground">
                {new Date(selectedExecution.startedAt).toLocaleString()}
              </div>
            </div>
            {selectedExecution.completedAt && (
              <div>
                <div className="text-sm font-medium mb-2">Completed</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(selectedExecution.completedAt).toLocaleString()}
                </div>
              </div>
            )}
            {selectedExecution.error && (
              <div>
                <div className="text-sm font-medium mb-2">Error</div>
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                  {selectedExecution.error}
                </div>
              </div>
            )}
            {selectedExecution.result && (
              <div>
                <div className="text-sm font-medium mb-2">Result</div>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(selectedExecution.result, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render based on tab
  if (tab === "catalog") {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playbooks.map((playbook) => (
            <Card key={playbook.id} className="cursor-pointer hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle className="text-base">{playbook.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {playbook.description || "No description"}
                </CardDescription>
              </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="capitalize">
                  {playbook.autopilotMode.replace(/_/g, " ").toLowerCase()}
                </Badge>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => setSelectedPlaybook(playbook)}>
                        <Play className="h-4 w-4 mr-2" />
                        Run
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Run Playbook: {playbook.name}</DialogTitle>
                        <DialogDescription>
                          {playbook.description || "Execute this playbook workflow"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-medium mb-2">Autopilot Mode</div>
                          <Badge>{playbook.autopilotMode.replace(/_/g, " ")}</Badge>
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => handleRunPlaybook(playbook.id)}
                          disabled={running}
                        >
                          {running ? "Running..." : "Execute Playbook"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => window.location.href = `/playbooks?id=${playbook.id}`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeletePlaybook(playbook.id)}
                        disabled={deleting === playbook.id}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {deleting === playbook.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
            </Card>
          ))}
        </div>

        {playbooks.length === 0 && (
          <EmptyState
            title="No playbooks"
            description="Create your first playbook to automate workflows"
            action={{
              label: "Create Playbook",
              onClick: () => window.location.href = "/playbooks?new=true",
            }}
          />
        )}
      </div>
    );
  }

  if (tab === "active-runs") {
    return (
      <div className="space-y-6">
        {activeRuns.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Active Runs</CardTitle>
              <CardDescription>Currently executing playbooks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activeRuns.map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="font-medium">{run.playbookName || "Playbook"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={run.status === "RUNNING" ? 50 : 0} className="w-32" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <Badge variant={run.status === "RUNNING" ? "default" : "secondary"}>
                      {run.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            title="No active runs"
            description="No playbooks are currently executing"
          />
        )}
      </div>
    );
  }

  if (tab === "history") {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Run History</CardTitle>
            <CardDescription>Execution logs and outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            {allExecutions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playbook</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allExecutions.map((exec) => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-medium">{exec.playbookName || "Playbook"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            exec.status === "COMPLETED" ? "default" :
                            exec.status === "FAILED" ? "destructive" :
                            exec.status === "RUNNING" ? "secondary" : "outline"
                          }
                        >
                          {exec.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDistanceToNow(new Date(exec.startedAt), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        {exec.completedAt
                          ? `${Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedExecution(exec)}
                        >
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No run history"
                description="Playbook executions will appear here"
              />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
