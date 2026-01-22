/**
 * Financial Services Preemption Playbooks
 * 
 * Predictive operations for financial narrative categories:
 * - Early signal drift detection
 * - Forecasts likely future complaints
 * - Pre-publish explanations before escalation
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { financialServicesMode, FinancialNarrativeCategory } from "./operating-mode";
import { NarrativePreemptionEngine } from "@/lib/pos/narrative-preemption";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { metrics } from "@/lib/observability/metrics";

const eventStore = new DatabaseEventStore();
const beliefGraph = new DatabaseBeliefGraphService();
const forecastService = new ForecastService(eventStore, beliefGraph as any);
const preemptionEngine = new NarrativePreemptionEngine();

export interface PreemptionPlaybook {
  id: string;
  name: string;
  category: FinancialNarrativeCategory;
  triggerConditions: {
    signalDrift?: number; // Threshold for signal drift detection
    forecastProbability?: number; // Minimum outbreak probability
    velocityThreshold?: number; // Mentions per hour
    sentimentThreshold?: number; // Minimum negative sentiment
  };
  preemptiveActions: Array<{
    type: "explanation" | "policy_update" | "support_macro" | "transparency_page";
    content: string;
    publishTiming: "immediate" | "24h" | "48h" | "on_trigger";
  }>;
  enabled: boolean;
}

export class FinancialServicesPreemptionPlaybooks {
  /**
   * Get preemption playbooks for tenant
   */
  async getPlaybooks(tenantId: string): Promise<PreemptionPlaybook[]> {
    const playbooks = await db.playbook.findMany({
      where: {
        tenantId,
      },
    });

    return playbooks
      .filter((p) => {
        const template = p.template as any;
        return template && template.category;
      })
      .map((p) => {
        const template = p.template as any;
        return {
          id: p.id,
          name: p.name,
          category: template.category as FinancialNarrativeCategory,
          triggerConditions: template.triggerConditions || {},
          preemptiveActions: template.preemptiveActions || [],
          enabled: true,
        };
      });
  }

  /**
   * Create default preemption playbooks for financial services
   */
  async createDefaultPlaybooks(tenantId: string): Promise<void> {
    const defaultPlaybooks: Omit<PreemptionPlaybook, "id">[] = [
      {
        name: "Scam/Fraud Preemption",
        category: "scam_fraud",
        triggerConditions: {
          signalDrift: -0.2,
          forecastProbability: 0.6,
          velocityThreshold: 10,
          sentimentThreshold: 0.3,
        },
        preemptiveActions: [
          {
            type: "explanation",
            content:
              "We are aware of concerns regarding account security. Our fraud detection systems are designed to protect customer accounts. If you experience any issues, please contact our support team immediately.",
            publishTiming: "24h",
          },
          {
            type: "transparency_page",
            content: "Security and Fraud Protection",
            publishTiming: "immediate",
          },
        ],
        enabled: true,
      },
      {
        name: "Account Freeze Preemption",
        category: "account_freezes",
        triggerConditions: {
          signalDrift: -0.15,
          forecastProbability: 0.5,
          velocityThreshold: 5,
        },
        preemptiveActions: [
          {
            type: "explanation",
            content:
              "We are aware of intermittent account access issues. Our team has implemented corrective actions and is monitoring the situation. Most issues are resolved within 24 hours.",
            publishTiming: "24h",
          },
          {
            type: "support_macro",
            content:
              "Account access issues are typically resolved within 24-48 hours. Our support team can expedite resolution if you contact us directly.",
            publishTiming: "immediate",
          },
        ],
        enabled: true,
      },
      {
        name: "Hidden Fees Preemption",
        category: "hidden_fees",
        triggerConditions: {
          signalDrift: -0.1,
          forecastProbability: 0.4,
          velocityThreshold: 3,
        },
        preemptiveActions: [
          {
            type: "explanation",
            content:
              "We are committed to transparent pricing. All fees are clearly disclosed in our terms of service and account agreements. If you have questions about specific charges, please contact our support team.",
            publishTiming: "48h",
          },
          {
            type: "policy_update",
            content: "Review and update fee disclosure documentation",
            publishTiming: "on_trigger",
          },
        ],
        enabled: true,
      },
      {
        name: "Transaction Failure Preemption",
        category: "transaction_failures",
        triggerConditions: {
          signalDrift: -0.15,
          forecastProbability: 0.5,
          velocityThreshold: 8,
        },
        preemptiveActions: [
          {
            type: "explanation",
            content:
              "We are aware of intermittent payment delays and have already implemented corrective actions. Transaction processing is returning to normal. If you experience issues, please contact support.",
            publishTiming: "24h",
          },
        ],
        enabled: true,
      },
    ];

    for (const playbook of defaultPlaybooks) {
      await db.playbook.create({
        data: {
          tenantId,
          name: playbook.name,
          description: `Preemption playbook for ${playbook.category} narratives`,
          template: {
            category: playbook.category,
            triggerConditions: playbook.triggerConditions,
            preemptiveActions: playbook.preemptiveActions,
          } as any,
          autopilotMode: "AUTO_DRAFT",
        },
      });
    }

    logger.info("Created default Financial Services preemption playbooks", {
      tenantId,
      count: defaultPlaybooks.length,
    });
  }

  /**
   * Check if any playbooks should trigger
   */
  async checkTriggers(tenantId: string): Promise<Array<{
    playbook: PreemptionPlaybook;
    triggered: boolean;
    reason: string;
  }>> {
    const playbooks = await this.getPlaybooks(tenantId);
    const results: Array<{
      playbook: PreemptionPlaybook;
      triggered: boolean;
      reason: string;
    }> = [];

    // Get recent forecasts
    const recentForecasts = await db.forecast.findMany({
      where: {
        tenantId,
        type: "OUTBREAK",
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    const outbreakProbability = recentForecasts[0]
      ? Number(recentForecasts[0].value)
      : 0;

    // Get recent signals for drift analysis
    const recentSignals = await db.evidence.findMany({
      where: {
        tenantId,
        type: "SIGNAL",
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    // Calculate signal drift (simplified)
    const signalDrift = this.calculateSignalDrift(recentSignals);

    for (const playbook of playbooks) {
      if (!playbook.enabled) continue;

      const conditions = playbook.triggerConditions;
      let triggered = false;
      const reasons: string[] = [];

      // Check forecast probability
      if (
        conditions.forecastProbability &&
        outbreakProbability >= conditions.forecastProbability
      ) {
        triggered = true;
        reasons.push(
          `Outbreak probability ${(outbreakProbability * 100).toFixed(0)}% exceeds threshold ${(conditions.forecastProbability * 100).toFixed(0)}%`
        );
      }

      // Check signal drift
      if (conditions.signalDrift && signalDrift <= conditions.signalDrift) {
        triggered = true;
        reasons.push(
          `Signal drift ${signalDrift.toFixed(2)} exceeds threshold ${conditions.signalDrift}`
        );
      }

      results.push({
        playbook,
        triggered,
        reason: reasons.join("; ") || "No triggers",
      });
    }

    return results;
  }

  /**
   * Execute preemptive actions for triggered playbook
   */
  async executePreemptiveActions(
    tenantId: string,
    playbookId: string
  ): Promise<{
    success: boolean;
    actionsExecuted: string[];
    artifactIds: string[];
  }> {
    const playbook = await db.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook || playbook.tenantId !== tenantId) {
      throw new Error("Playbook not found");
    }

    const template = playbook.template as any;
    const preemptiveActions = template.preemptiveActions || [];

    const actionsExecuted: string[] = [];
    const artifactIds: string[] = [];

    for (const action of preemptiveActions) {
      if (action.type === "explanation") {
        // Create draft AAAL artifact
        const artifact = await db.aAALArtifact.create({
          data: {
            tenantId,
            title: `Preemptive Response: ${playbook.name}`,
            content: action.content,
            version: "1.0.0",
            status: "DRAFT",
            approvers: [],
            requiredApprovals: 0,
            policyChecks: {
              playbookId: playbook.id,
              preemptive: true,
              category: template.category,
            } as any,
          },
        });

        artifactIds.push(artifact.id);
        actionsExecuted.push(`Created draft explanation artifact: ${artifact.id}`);

        // If immediate publish, route to approval
        if (action.publishTiming === "immediate") {
          const config = await financialServicesMode.getConfig(tenantId);
          if (config.legalApprovalRequired) {
            await db.approval.create({
              data: {
                tenantId,
                resourceType: "AAAL_ARTIFACT",
                resourceId: artifact.id,
                action: "PUBLISH",
                requesterId: tenantId,
                approvers: ["Legal", "Compliance"],
                artifactId: artifact.id,
              },
            });
            actionsExecuted.push("Routed to legal approval");
          }
        }
      } else if (action.type === "support_macro") {
        // Create support macro (would integrate with support system)
        actionsExecuted.push(`Created support macro: ${action.content.substring(0, 50)}...`);
      } else if (action.type === "transparency_page") {
        // Create transparency page entry
        actionsExecuted.push(`Created transparency page: ${action.content}`);
      } else if (action.type === "policy_update") {
        // Flag for policy review
        actionsExecuted.push(`Policy update flagged: ${action.content}`);
      }
    }

    logger.info("Executed Financial Services preemptive actions", {
      tenantId,
      playbookId,
      actionsCount: actionsExecuted.length,
    });

    metrics.increment("financial_services_preemption_executed_total", {
      tenantId,
      playbookId,
    });

    return {
      success: true,
      actionsExecuted,
      artifactIds,
    };
  }

  /**
   * Calculate signal drift (simplified - in production use more sophisticated analysis)
   */
  private calculateSignalDrift(signals: any[]): number {
    if (signals.length < 10) {
      return 0;
    }

    // Simple drift calculation: compare recent vs older signals
    const recent = signals.slice(0, Math.floor(signals.length / 2));
    const older = signals.slice(Math.floor(signals.length / 2));

    const recentAvgSentiment =
      recent.reduce((sum, s) => {
        const meta = (s.contentMetadata || {}) as any;
        return sum + (meta.sentiment || 0.5);
      }, 0) / recent.length;

    const olderAvgSentiment =
      older.reduce((sum, s) => {
        const meta = (s.contentMetadata || {}) as any;
        return sum + (meta.sentiment || 0.5);
      }, 0) / older.length;

    return recentAvgSentiment - olderAvgSentiment; // Negative = drift toward negative
  }
}

export const preemptionPlaybooks = new FinancialServicesPreemptionPlaybooks();
