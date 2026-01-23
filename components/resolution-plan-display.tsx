/**
 * Resolution Plan Display Component
 * 
 * User-friendly display of resolution plans with proper formatting
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText,
  Shield,
  Users,
  Calendar,
  ArrowRight,
} from "lucide-react";

interface ResolutionPlanData {
  customerPlan?: {
    title?: string;
    summary?: string;
    steps?: Array<{
      stepNumber?: number;
      title?: string;
      description?: string;
      estimatedTime?: string;
      requiredActions?: string[];
      expectedOutcome?: string;
    }>;
    nextSteps?: string[];
    contactInfo?: {
      email?: string;
      phone?: string;
      supportUrl?: string;
    };
  };
  internalPlan?: {
    title?: string;
    summary?: string;
    phases?: Array<{
      phaseNumber?: number;
      name?: string;
      description?: string;
      tasks?: Array<{
        taskId?: string;
        title?: string;
        description?: string;
        assignedTo?: string;
        dueDate?: string;
        dependencies?: string[];
        status?: "pending" | "in_progress" | "completed";
      }>;
      estimatedDuration?: string;
    }>;
    requiredApprovals?: Array<{
      type?: string;
      reason?: string;
      approver?: string;
    }>;
    riskMitigation?: Array<{
      risk?: string;
      mitigation?: string;
      owner?: string;
    }>;
  };
  recommendedDecision?: string;
  evidenceChecklist?: Array<{
    item?: string;
    status?: "pending" | "collected" | "verified";
    source?: string;
    notes?: string;
  }>;
  chargebackReadiness?: {
    merchantResponse?: string;
    evidenceStrength?: "weak" | "moderate" | "strong";
    winProbability?: number;
    recommendedActions?: string[];
    deadline?: string;
  };
  safetySteps?: Array<{
    action?: string;
    priority?: "immediate" | "high" | "medium" | "low";
    description?: string;
    completed?: boolean;
  }>;
  timeline?: {
    events?: Array<{
      timestamp?: string;
      event?: string;
      description?: string;
      impact?: string;
    }>;
    rootCause?: string;
    resolution?: string;
    prevention?: string;
  };
}

interface ResolutionPlanDisplayProps {
  resolution: ResolutionPlanData;
  showInternal?: boolean;
  variant?: "customer" | "internal" | "both";
}

export function ResolutionPlanDisplay({ 
  resolution, 
  showInternal = false,
  variant = "both" 
}: ResolutionPlanDisplayProps) {
  // Helper to safely parse JSON if needed
  const parsePlan = (plan: unknown): ResolutionPlanData["customerPlan"] | null => {
    if (!plan) return null;
    if (typeof plan === "string") {
      try {
        return JSON.parse(plan);
      } catch {
        return null;
      }
    }
    if (typeof plan === "object") {
      return plan as ResolutionPlanData["customerPlan"];
    }
    return null;
  };

  const parseInternalPlan = (plan: unknown): ResolutionPlanData["internalPlan"] | null => {
    if (!plan) return null;
    if (typeof plan === "string") {
      try {
        return JSON.parse(plan) as ResolutionPlanData["internalPlan"];
      } catch {
        return null;
      }
    }
    if (typeof plan === "object") {
      return plan as ResolutionPlanData["internalPlan"];
    }
    return null;
  };

  const customerPlan = resolution.customerPlan || parsePlan(resolution.customerPlan);
  const internalPlan = resolution.internalPlan || parseInternalPlan(resolution.internalPlan);

  return (
    <div className="space-y-6">
      {/* Customer Plan */}
      {(variant === "customer" || variant === "both") && customerPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {customerPlan.title || "Your Resolution Plan"}
            </CardTitle>
            {customerPlan.summary && (
              <CardDescription>{customerPlan.summary}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Steps */}
            {customerPlan.steps && customerPlan.steps.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Steps to Resolution</h4>
                <div className="space-y-3">
                  {customerPlan.steps.map((step, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {step.stepNumber || idx + 1}
                        </div>
                        {idx < customerPlan.steps!.length - 1 && (
                          <div className="w-px h-full min-h-[40px] bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <h5 className="font-medium mb-1">{step.title || `Step ${idx + 1}`}</h5>
                        <p className="text-sm text-muted-foreground mb-2">
                          {step.description || step.title}
                        </p>
                        {step.estimatedTime && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Estimated: {step.estimatedTime}</span>
                          </div>
                        )}
                        {step.requiredActions && step.requiredActions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium">Required Actions:</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
                              {step.requiredActions.map((action, ai) => (
                                <li key={ai}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {step.expectedOutcome && (
                          <div className="mt-2 p-2 bg-muted rounded text-xs">
                            <span className="font-medium">Expected Outcome: </span>
                            <span className="text-muted-foreground">{step.expectedOutcome}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            {customerPlan.nextSteps && customerPlan.nextSteps.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Next Steps</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {customerPlan.nextSteps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Contact Info */}
            {customerPlan.contactInfo && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Contact Information</h4>
                <div className="space-y-1 text-sm">
                  {customerPlan.contactInfo.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <a href={`mailto:${customerPlan.contactInfo.email}`} className="text-primary hover:underline">
                        {customerPlan.contactInfo.email}
                      </a>
                    </div>
                  )}
                  {customerPlan.contactInfo.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Phone:</span>
                      <a href={`tel:${customerPlan.contactInfo.phone}`} className="text-primary hover:underline">
                        {customerPlan.contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {customerPlan.contactInfo.supportUrl && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Support:</span>
                      <a href={customerPlan.contactInfo.supportUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Visit Support Portal
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Internal Plan */}
      {(variant === "internal" || (variant === "both" && showInternal)) && internalPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {internalPlan.title || "Internal Action Plan"}
            </CardTitle>
            {internalPlan.summary && (
              <CardDescription>{internalPlan.summary}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Phases */}
            {internalPlan.phases && internalPlan.phases.length > 0 && (
              <div className="space-y-6">
                {internalPlan.phases.map((phase, pIdx) => (
                  <div key={pIdx} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Phase {phase.phaseNumber || pIdx + 1}</Badge>
                      <h4 className="font-semibold">{phase.name || `Phase ${pIdx + 1}`}</h4>
                      {phase.estimatedDuration && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {phase.estimatedDuration}
                        </span>
                      )}
                    </div>
                    {phase.description && (
                      <p className="text-sm text-muted-foreground">{phase.description}</p>
                    )}
                    {phase.tasks && phase.tasks.length > 0 && (
                      <div className="ml-4 space-y-2">
                        {phase.tasks.map((task, tIdx) => (
                          <div key={tIdx} className="flex items-start gap-2 p-2 bg-muted rounded">
                            <div className="mt-1">
                              {task.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : task.status === "in_progress" ? (
                                <Clock className="h-4 w-4 text-blue-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{task.title || task.description}</p>
                              {task.description && task.title && (
                                <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                                {task.assignedTo && (
                                  <span>Assigned to: {task.assignedTo}</span>
                                )}
                                {task.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Due: {task.dueDate}
                                  </span>
                                )}
                                {task.dependencies && task.dependencies.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" />
                                    Depends on: {task.dependencies.join(", ")}
                                  </span>
                                )}
                                {task.status && (
                                  <Badge variant={task.status === "completed" ? "default" : "secondary"} className="text-xs">
                                    {task.status}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {pIdx < internalPlan.phases!.length - 1 && <Separator />}
                  </div>
                ))}
              </div>
            )}

            {/* Required Approvals */}
            {internalPlan.requiredApprovals && internalPlan.requiredApprovals.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Required Approvals
                </h4>
                <div className="space-y-2">
                  {internalPlan.requiredApprovals.map((approval, idx) => (
                    <div key={idx} className="p-2 bg-muted rounded text-sm">
                      <div className="font-medium">{approval.type}</div>
                      <div className="text-muted-foreground text-xs mt-1">{approval.reason}</div>
                      {approval.approver && (
                        <div className="text-xs text-muted-foreground mt-1">Approver: {approval.approver}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Mitigation */}
            {internalPlan.riskMitigation && internalPlan.riskMitigation.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <h4 className="font-semibold text-sm">Risk Mitigation</h4>
                <div className="space-y-2">
                  {internalPlan.riskMitigation.map((risk, idx) => (
                    <div key={idx} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <div className="font-medium text-sm">{risk.risk}</div>
                      <div className="text-xs text-muted-foreground mt-1">{risk.mitigation}</div>
                      {risk.owner && (
                        <div className="text-xs text-muted-foreground mt-1">Owner: {risk.owner}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommended Decision */}
      {resolution.recommendedDecision && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Recommended Decision
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{resolution.recommendedDecision}</p>
          </CardContent>
        </Card>
      )}

      {/* Evidence Checklist */}
      {resolution.evidenceChecklist && resolution.evidenceChecklist.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Evidence Checklist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolution.evidenceChecklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded">
                  {item.status === "verified" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : item.status === "collected" ? (
                    <Clock className="h-4 w-4 text-blue-600" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="flex-1 text-sm">{item.item}</span>
                  <Badge variant={item.status === "verified" ? "default" : "secondary"}>
                    {item.status || "pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Safety Steps */}
      {resolution.safetySteps && resolution.safetySteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Safety Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolution.safetySteps.map((step, idx) => (
                <div key={idx} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{step.action}</span>
                    {step.priority && (
                      <Badge variant={step.priority === "immediate" ? "destructive" : "secondary"}>
                        {step.priority}
                      </Badge>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                  {step.completed && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Completed</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chargeback Readiness */}
      {resolution.chargebackReadiness && (
        <Card>
          <CardHeader>
            <CardTitle>Chargeback Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resolution.chargebackReadiness.merchantResponse && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Merchant Response</h4>
                <p className="text-sm">{resolution.chargebackReadiness.merchantResponse}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Evidence Strength</h4>
                <Badge variant={
                  resolution.chargebackReadiness.evidenceStrength === "strong" ? "default" :
                  resolution.chargebackReadiness.evidenceStrength === "moderate" ? "secondary" :
                  "outline"
                }>
                  {resolution.chargebackReadiness.evidenceStrength || "unknown"}
                </Badge>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Win Probability</h4>
                <div className="text-2xl font-bold">
                  {resolution.chargebackReadiness.winProbability 
                    ? `${Math.round(resolution.chargebackReadiness.winProbability * 100)}%`
                    : "N/A"}
                </div>
              </div>
            </div>
            {resolution.chargebackReadiness.recommendedActions && resolution.chargebackReadiness.recommendedActions.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm mb-2">Recommended Actions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {resolution.chargebackReadiness.recommendedActions.map((action, idx) => (
                    <li key={idx}>{action}</li>
                  ))}
                </ul>
              </div>
            )}
            {resolution.chargebackReadiness.deadline && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Deadline: {resolution.chargebackReadiness.deadline}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {resolution.timeline && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {resolution.timeline.events && resolution.timeline.events.length > 0 && (
              <div className="space-y-4">
                {resolution.timeline.events.map((event, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {idx < resolution.timeline!.events!.length - 1 && (
                        <div className="w-px h-full min-h-[60px] bg-border mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{event.event}</span>
                        {event.timestamp && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                      {event.impact && (
                        <div className="mt-1 text-xs text-muted-foreground">Impact: {event.impact}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {resolution.timeline.rootCause && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Root Cause</h4>
                <p className="text-sm text-muted-foreground">{resolution.timeline.rootCause}</p>
              </div>
            )}
            {resolution.timeline.resolution && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Resolution</h4>
                <p className="text-sm text-muted-foreground">{resolution.timeline.resolution}</p>
              </div>
            )}
            {resolution.timeline.prevention && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Prevention</h4>
                <p className="text-sm text-muted-foreground">{resolution.timeline.prevention}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
