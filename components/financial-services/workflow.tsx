"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, Clock, AlertCircle, ArrowRight, Target, TrendingUp, Award } from "lucide-react";
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
      {/* Strategic Status Summary */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="h-5 w-5 text-primary" />
            Strategic Progression Status
          </CardTitle>
          <CardDescription className="text-base">
            Track your journey from initial visibility to full operational maturity
          </CardDescription>
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
      <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-background dark:from-blue-950/20">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">Day 1: Foundation & Awareness</CardTitle>
              <CardDescription className="text-base mt-1">
                Establish immediate situational awareness and eliminate operational blind spots
              </CardDescription>
            </div>
            {milestonesByStage.day1.every(m => m.completed) && (
              <Badge className="bg-green-600">
                <Award className="mr-1 h-3 w-3" />
                Complete
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {milestonesByStage.day1.map((milestone) => (
              <div
                key={milestone.id}
                className={`flex items-start gap-4 p-4 border rounded-lg transition-all duration-200 ${
                  milestone.completed 
                    ? "bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-800 hover:shadow-md" 
                    : "hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                {milestone.completed ? (
                  <div className="p-1.5 bg-green-500/10 rounded-full">
                    <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-muted rounded-full">
                    <Clock className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-base">{milestone.name}</h4>
                    {milestone.completed && (
                      <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/20">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Completed
                        {milestone.completedAt &&
                          ` ${format(new Date(milestone.completedAt), "MMM d")}`}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">
                    {milestone.description}
                  </p>
                  {milestone.requiredActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {milestone.requiredActions.map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Day 7 Milestones */}
      <Card className="border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50/50 to-background dark:from-yellow-950/20">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">Day 7: Authority & De-Escalation</CardTitle>
              <CardDescription className="text-base mt-1">
                Transform speculation into verified, authoritative explanations that build trust
              </CardDescription>
            </div>
            {milestonesByStage.day7.length > 0 && milestonesByStage.day7.every(m => m.completed) && (
              <Badge className="bg-green-600">
                <Award className="mr-1 h-3 w-3" />
                Complete
              </Badge>
            )}
          </div>
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
      <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-background dark:from-green-950/20">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">Day 30: Governance & Institutionalization</CardTitle>
              <CardDescription className="text-base mt-1">
                Integrate narrative control into your financial risk governance framework
              </CardDescription>
            </div>
            {milestonesByStage.day30.length > 0 && milestonesByStage.day30.every(m => m.completed) && (
              <Badge className="bg-purple-600">
                <Award className="mr-1 h-3 w-3" />
                Complete
              </Badge>
            )}
          </div>
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

      {/* Strategic Next Actions */}
      {progress.nextActions.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="h-5 w-5 text-primary" />
              Recommended Strategic Actions
            </CardTitle>
            <CardDescription className="text-base">
              Prioritized next steps to advance your narrative governance maturity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {progress.nextActions.map((action, idx) => (
                <div 
                  key={idx} 
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all duration-200"
                >
                  <div className="p-1 bg-primary/10 rounded-full mt-0.5">
                    <ArrowRight className="size-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium leading-6 flex-1">{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
