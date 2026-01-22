/**
 * Financial Services Workflow Engine
 * 
 * Implements Day 1 → Day 7 → Day 30 workflow progression
 * Tracks milestones and automates workflow transitions
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { financialServicesMode, FinancialServicesConfig } from "./operating-mode";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();
const beliefGraph = new DatabaseBeliefGraphService();
const forecastService = new ForecastService(eventStore, beliefGraph as any);

export interface WorkflowMilestone {
  id: string;
  stage: "day1" | "day7" | "day30";
  name: string;
  description: string;
  completed: boolean;
  completedAt?: Date;
  requiredActions: string[];
  completedActions: string[];
}

export interface WorkflowProgress {
  currentStage: "day1" | "day7" | "day30" | "complete";
  milestones: WorkflowMilestone[];
  nextActions: string[];
  progressPercentage: number;
}

export class FinancialServicesWorkflowEngine {
  /**
   * Get workflow progress for tenant
   */
  async getProgress(tenantId: string): Promise<WorkflowProgress> {
    const config = await financialServicesMode.getConfig(tenantId);
    const stage = await financialServicesMode.getWorkflowStage(tenantId);

    const milestones = this.getMilestonesForStage(stage, config);
    const completedCount = milestones.filter((m) => m.completed).length;
    const progressPercentage = milestones.length > 0
      ? Math.round((completedCount / milestones.length) * 100)
      : 0;

    // Check milestone completion status
    await this.checkMilestoneCompletion(tenantId, milestones, config);

    const nextActions = this.getNextActions(stage, milestones);

    return {
      currentStage: stage,
      milestones,
      nextActions,
      progressPercentage,
    };
  }

  /**
   * Check and update milestone completion status
   */
  private async checkMilestoneCompletion(
    tenantId: string,
    milestones: WorkflowMilestone[],
    config: FinancialServicesConfig
  ): Promise<void> {
    for (const milestone of milestones) {
      if (milestone.completed) continue;

      let allActionsCompleted = true;

      // Check if required actions are completed
      for (const action of milestone.requiredActions) {
        const completed = await this.checkActionCompletion(tenantId, action, milestone.stage);
        if (!completed) {
          allActionsCompleted = false;
          break;
        }
      }

      if (allActionsCompleted && !milestone.completed) {
        milestone.completed = true;
        milestone.completedAt = new Date();

        // Update config based on milestone
        if (milestone.stage === "day1" && !config.day1Completed) {
          await financialServicesMode.completeDay1(tenantId);
        } else if (milestone.stage === "day7" && !config.day7Completed) {
          await financialServicesMode.completeDay7(tenantId);
        } else if (milestone.stage === "day30" && !config.day30Completed) {
          await financialServicesMode.completeDay30(tenantId);
        }

        logger.info("Financial Services milestone completed", {
          tenantId,
          milestone: milestone.id,
          stage: milestone.stage,
        });

        metrics.increment("financial_services_milestone_completed_total", {
          tenantId,
          milestone: milestone.id,
        });
      }
    }
  }

  /**
   * Check if specific action is completed
   */
  private async checkActionCompletion(
    tenantId: string,
    action: string,
    stage: "day1" | "day7" | "day30"
  ): Promise<boolean> {
    switch (action) {
      case "select_operating_mode":
        const config = await financialServicesMode.getConfig(tenantId);
        return config.enabled && config.governanceLevel === "financial";

      case "connect_data_sources":
        const sources = await db.connector.count({
          where: { tenantId },
        });
        return sources >= 3; // At least 3 sources connected

      case "define_escalation_rules":
        const config2 = await financialServicesMode.getConfig(tenantId);
        return config2.escalationRules.length > 0;

      case "receive_perception_brief":
        // Check if narrative risk brief has been generated
        const briefExists = await db.forecast.findFirst({
          where: {
            tenantId,
            type: "OUTBREAK",
            createdAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            },
          },
        });
        return !!briefExists;

      case "select_narrative_cluster":
        const clusters = await db.claimCluster.count({
          where: { tenantId },
        });
        return clusters > 0;

      case "generate_explanation":
        const artifacts = await db.aAALArtifact.count({
          where: { tenantId },
        });
        return artifacts > 0;

      case "legal_review":
        const approvals = await db.approval.findFirst({
          where: {
            tenantId,
            decision: "APPROVED",
            createdAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
            },
          },
        });
        return !!approvals;

      case "publish_artifact":
        const publishedArtifacts = await db.aAALArtifact.count({
          where: {
            tenantId,
            status: "PUBLISHED",
          },
        });
        return publishedArtifacts > 0;

      case "measure_impact":
        // Check if impact metrics exist
        const impactMetrics = await db.forecast.findFirst({
          where: {
            tenantId,
            type: "OUTBREAK",
            createdAt: {
              gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // Last 14 days
            },
          },
        });
        return !!impactMetrics;

      case "monthly_report":
        // Check if monthly report exists (30+ days since start)
        const config3 = await financialServicesMode.getConfig(tenantId);
        if (config3.onboardingStartedAt) {
          const daysSinceStart =
            (Date.now() - config3.onboardingStartedAt.getTime()) / (24 * 60 * 60 * 1000);
          return daysSinceStart >= 30;
        }
        return false;

      case "preemption_playbooks":
        const playbooks = await db.playbook.count({
          where: { tenantId },
        });
        return playbooks > 0;

      case "regulatory_audit":
        const audits = await db.audit.count({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
        });
        return audits > 0;

      default:
        return false;
    }
  }

  /**
   * Get milestones for current stage
   */
  private getMilestonesForStage(
    stage: "day1" | "day7" | "day30" | "complete",
    config: FinancialServicesConfig
  ): WorkflowMilestone[] {
    const milestones: WorkflowMilestone[] = [];

    if (stage === "day1" || stage === "day7" || stage === "day30") {
      // Day 1 milestones
      if (stage === "day1") {
        milestones.push({
          id: "day1-mode",
          stage: "day1",
          name: "Select Financial Risk Operating Mode",
          description: "Enable Narrative Risk Early Warning configuration",
          completed: config.enabled && config.governanceLevel === "financial",
          completedAt: config.enabled ? config.onboardingStartedAt : undefined,
          requiredActions: ["select_operating_mode"],
          completedActions: [],
        });

        milestones.push({
          id: "day1-sources",
          stage: "day1",
          name: "Connect Initial Data Sources",
          description: "Connect 3-5 data sources (Reddit, X, reviews, support tickets, etc.)",
          completed: false,
          requiredActions: ["connect_data_sources"],
          completedActions: [],
        });

        milestones.push({
          id: "day1-rules",
          stage: "day1",
          name: "Define Non-Starters & Escalation Rules",
          description: "Set up hard rules for fraud/scam, data breach, regulator references",
          completed: config.escalationRules.length > 0,
          requiredActions: ["define_escalation_rules"],
          completedActions: [],
        });

        milestones.push({
          id: "day1-brief",
          stage: "day1",
          name: "Receive First Perception Brief",
          description: "Review top emerging narrative clusters and outbreak probability",
          completed: config.day1Completed,
          completedAt: config.day1CompletedAt,
          requiredActions: ["receive_perception_brief"],
          completedActions: [],
        });
      }

      // Day 7 milestones
      if (stage === "day7" || (stage === "day30" && config.day1Completed)) {
        milestones.push({
          id: "day7-cluster",
          stage: "day7",
          name: "Select High-Risk Narrative Cluster",
          description: "Choose a cluster (e.g., 'Bank froze my account') and review claim graph",
          completed: false,
          requiredActions: ["select_narrative_cluster"],
          completedActions: [],
        });

        milestones.push({
          id: "day7-explanation",
          stage: "day7",
          name: "Generate Evidence-Backed Explanations",
          description: "Create public-facing explanation, internal risk brief, and support playbooks",
          completed: false,
          requiredActions: ["generate_explanation"],
          completedActions: [],
        });

        milestones.push({
          id: "day7-legal",
          stage: "day7",
          name: "Legal & Compliance Review",
          description: "Route explanation through legal approval gates",
          completed: false,
          requiredActions: ["legal_review"],
          completedActions: [],
        });

        milestones.push({
          id: "day7-publish",
          stage: "day7",
          name: "Publish with Confidence",
          description: "Publish to trust center, knowledge base, and partner communications",
          completed: false,
          requiredActions: ["publish_artifact"],
          completedActions: [],
        });

        milestones.push({
          id: "day7-impact",
          stage: "day7",
          name: "Measure Immediate Impact",
          description: "Track narrative velocity change, support ticket deflection, AI summary shifts",
          completed: config.day7Completed,
          completedAt: config.day7CompletedAt,
          requiredActions: ["measure_impact"],
          completedActions: [],
        });
      }

      // Day 30 milestones
      if (stage === "day30" && config.day7Completed) {
        milestones.push({
          id: "day30-report",
          stage: "day30",
          name: "Monthly Impact & Risk Report",
          description: "Generate executive-ready report showing outbreaks prevented, time-to-resolution, cost reduction",
          completed: false,
          requiredActions: ["monthly_report"],
          completedActions: [],
        });

        milestones.push({
          id: "day30-preemption",
          stage: "day30",
          name: "Preemption Playbooks Go Live",
          description: "Enable predictive operations with early signal drift detection",
          completed: false,
          requiredActions: ["preemption_playbooks"],
          completedActions: [],
        });

        milestones.push({
          id: "day30-audit",
          stage: "day30",
          name: "Regulatory & Audit Readiness",
          description: "Export evidence bundles, approval trails, publication history for regulatory exams",
          completed: config.day30Completed,
          completedAt: config.day30CompletedAt,
          requiredActions: ["regulatory_audit"],
          completedActions: [],
        });
      }
    }

    return milestones;
  }

  /**
   * Get next actions for current stage
   */
  private getNextActions(
    stage: "day1" | "day7" | "day30" | "complete",
    milestones: WorkflowMilestone[]
  ): string[] {
    const incompleteMilestones = milestones.filter((m) => !m.completed);
    if (incompleteMilestones.length === 0) {
      return ["All milestones completed for this stage"];
    }

    const nextMilestone = incompleteMilestones[0];
    return nextMilestone.requiredActions.filter(
      (action) => !nextMilestone.completedActions.includes(action)
    );
  }

  /**
   * Get workflow status summary
   */
  async getStatusSummary(tenantId: string): Promise<{
    stage: string;
    progress: number;
    daysSinceStart: number;
    milestonesCompleted: number;
    milestonesTotal: number;
  }> {
    const config = await financialServicesMode.getConfig(tenantId);
    const progress = await this.getProgress(tenantId);

    const daysSinceStart = config.onboardingStartedAt
      ? Math.floor(
          (Date.now() - config.onboardingStartedAt.getTime()) / (24 * 60 * 60 * 1000)
        )
      : 0;

    return {
      stage: progress.currentStage,
      progress: progress.progressPercentage,
      daysSinceStart,
      milestonesCompleted: progress.milestones.filter((m) => m.completed).length,
      milestonesTotal: progress.milestones.length,
    };
  }
}

export const workflowEngine = new FinancialServicesWorkflowEngine();
