"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface WorkflowMilestone {
  id: string;
  stage: "day1" | "day7" | "day30";
  name: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  requiredActions: string[];
  completedActions: string[];
}

interface WorkflowProgress {
  currentStage: "day1" | "day7" | "day30" | "complete";
  milestones: WorkflowMilestone[];
  nextActions: string[];
  progressPercentage: number;
}

interface WorkflowStatus {
  stage: string;
  progress: number;
  daysSinceStart: number;
  milestonesCompleted: number;
  milestonesTotal: number;
}

export function FinancialServicesWorkflow() {
  const [progress, setProgress] = React.useState<WorkflowProgress | null>(null);
  const [status, setStatus] = React.useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/financial-services/workflow");
        if (!response.ok) {
          throw new Error("Failed to fetch workflow progress");
        }
        const data = await response.json();
        if (!cancelled) {
          setProgress(data.progress);
          setStatus(data.statusSummary);
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
    };

    fetchWorkflow();
    const interval = setInterval(fetchWorkflow, 60000); // Refresh every minute

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Services Workflow</CardTitle>
          <CardDescription>Loading workflow progress...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Clock className="size-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !progress || !status) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Services Workflow</CardTitle>
          <CardDescription>Day 1 → Day 7 → Day 30 Operating Model</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {error || "Failed to load workflow progress"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getStageLabel = (stage: string) => {
    switch (stage) {
      case "day1":
        return "Day 1 - Visibility, Control, and Safety";
      case "day7":
        return "Day 7 - Authority, Control, and De-Escalation";
      case "day30":
        return "Day 30 - Governance, Proof, and Institutionalization";
      case "complete":
        return "Complete - Fully Operational";
      default:
        return stage;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "day1":
        return "bg-blue-500";
      case "day7":
        return "bg-yellow-500";
      case "day30":
        return "bg-green-500";
      case "complete":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const milestonesByStage = {
    day1: progress.milestones.filter((m) => m.stage === "day1"),
    day7: progress.milestones.filter((m) => m.stage === "day7"),
    day30: progress.milestones.filter((m) => m.stage === "day30"),
  };

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Status</CardTitle>
          <CardDescription>Current stage and progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current Stage</span>
                <Badge variant="outline" className={getStageColor(progress.currentStage)}>
                  {getStageLabel(progress.currentStage)}
                </Badge>
              </div>
              <Progress value={status.progress} className="h-3" />
              <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                <span>
                  {status.milestonesCompleted} of {status.milestonesTotal} milestones completed
                </span>
                <span>{status.daysSinceStart} days since start</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day 1 Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Day 1 - Visibility, Control, and Safety</CardTitle>
          <CardDescription>
            Create immediate situational awareness and eliminate blind spots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestonesByStage.day1.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
              >
                {milestone.completed ? (
                  <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                ) : (
                  <Clock className="size-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{milestone.name}</h4>
                    {milestone.completed && (
                      <Badge variant="outline" className="text-xs">
                        Completed
                        {milestone.completedAt &&
                          ` ${format(new Date(milestone.completedAt), "MMM d")}`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {milestone.description}
                  </p>
                  {milestone.requiredActions.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Required: {milestone.requiredActions.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Day 7 Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Day 7 - Authority, Control, and De-Escalation</CardTitle>
          <CardDescription>
            Replace speculation and emotion with verified, authoritative explanations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestonesByStage.day7.length > 0 ? (
              milestonesByStage.day7.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  {milestone.completed ? (
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                  ) : (
                    <Clock className="size-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{milestone.name}</h4>
                      {milestone.completed && (
                        <Badge variant="outline" className="text-xs">
                          Completed
                          {milestone.completedAt &&
                            ` ${format(new Date(milestone.completedAt), "MMM d")}`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>Day 1 Required</AlertTitle>
                <AlertDescription>
                  Complete Day 1 milestones to unlock Day 7 workflow.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Day 30 Milestones */}
      <Card>
        <CardHeader>
          <CardTitle>Day 30 - Governance, Proof, and Institutionalization</CardTitle>
          <CardDescription>
            Make narrative control part of financial risk governance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestonesByStage.day30.length > 0 ? (
              milestonesByStage.day30.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  {milestone.completed ? (
                    <CheckCircle2 className="size-5 text-green-600 mt-0.5" />
                  ) : (
                    <Clock className="size-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{milestone.name}</h4>
                      {milestone.completed && (
                        <Badge variant="outline" className="text-xs">
                          Completed
                          {milestone.completedAt &&
                            ` ${format(new Date(milestone.completedAt), "MMM d")}`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {milestone.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <Alert>
                <AlertCircle className="size-4" />
                <AlertTitle>Day 7 Required</AlertTitle>
                <AlertDescription>
                  Complete Day 7 milestones to unlock Day 30 workflow.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Next Actions */}
      {progress.nextActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Next Actions</CardTitle>
            <CardDescription>Recommended next steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {progress.nextActions.map((action, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="size-4 text-muted-foreground" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
