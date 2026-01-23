/**
 * Crisis Response Automation
 * 
 * Automated crisis response system that detects threats and responds
 * across all channels with pre-approved playbooks.
 */

import { ResponseGenerator } from "./response-generator";
import { MultiPlatformDistributor } from "./multi-platform-distributor";
import { ApprovalGateway } from "./approval-gateway";

export interface CrisisAlert {
  id: string;
  tenantId: string;
  type: "sentiment_spike" | "volume_spike" | "negative_narrative" | "coordinated_attack";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  affectedPlatforms: string[];
  detectedAt: string;
  narrative?: string;
  evidence?: string[];
}

export interface CrisisResponse {
  alertId: string;
  response: string;
  platforms: string[];
  status: "pending" | "approved" | "published" | "rejected";
  publishedUrls?: string[];
  error?: string;
}

export interface CrisisPlaybook {
  id: string;
  name: string;
  triggerConditions: {
    type: CrisisAlert["type"];
    severity: CrisisAlert["severity"][];
    platforms?: string[];
  };
  responseTemplate: string;
  autoApprove?: boolean;
  platforms: string[];
  enabled: boolean;
}

export class CrisisResponder {
  private responseGenerator: ResponseGenerator;
  private distributor: MultiPlatformDistributor;
  private approvalGateway: ApprovalGateway;
  private playbooks: Map<string, CrisisPlaybook> = new Map();

  constructor() {
    this.responseGenerator = new ResponseGenerator();
    this.distributor = new MultiPlatformDistributor();
    this.approvalGateway = new ApprovalGateway();
  }

  /**
   * Register crisis playbook
   */
  registerPlaybook(playbook: CrisisPlaybook): void {
    this.playbooks.set(playbook.id, playbook);
  }

  /**
   * Handle crisis alert
   */
  async handleCrisis(alert: CrisisAlert): Promise<CrisisResponse> {
    // Find matching playbook
    const playbook = this.findMatchingPlaybook(alert);

    if (!playbook) {
      return {
        alertId: alert.id,
        response: "",
        platforms: [],
        status: "rejected",
        error: "No matching playbook found",
      };
    }

    // Generate response from template
    const generated = await this.responseGenerator.generate({
      context: alert.description,
      intent: "defend",
      tone: "professional",
      includeEvidence: true,
      maxLength: 1000,
    });

    // Customize response with playbook template
    const response = this.customizeResponse(
      generated.response,
      playbook.responseTemplate,
      alert
    );

    // Check if auto-approve
    let status: CrisisResponse["status"] = "pending";
    let publishedUrls: string[] = [];

    if (playbook.autoApprove && alert.severity !== "critical") {
      status = "approved";
    } else {
      // Route for approval
      const approval = await this.approvalGateway.requestApproval(
        {
          resourceType: "crisis_response",
          resourceId: alert.id,
          action: "publish",
          content: response,
          context: {
            forum: "crisis",
            postUrl: "",
            postAuthor: "System",
            brandName: "Unknown",
          },
          priority: "high",
        },
        alert.tenantId
      );

      status = approval.status === "approved" ? "approved" : "pending";
    }

    // Publish if approved
    if (status === "approved") {
      try {
        const distributionResults = await this.distributor.distribute({
          tenantId: alert.tenantId,
          response,
          platforms: playbook.platforms as any,
          requireApproval: false, // Already approved
        });

        publishedUrls = distributionResults
          .filter(r => r.success && r.url)
          .map(r => r.url!);

        status = publishedUrls.length > 0 ? "published" : "approved";
      } catch (error) {
        status = "rejected";
        return {
          alertId: alert.id,
          response,
          platforms: playbook.platforms,
          status,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    return {
      alertId: alert.id,
      response,
      platforms: playbook.platforms,
      status,
      publishedUrls,
    };
  }

  /**
   * Find matching playbook for alert
   */
  private findMatchingPlaybook(alert: CrisisAlert): CrisisPlaybook | null {
    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;

      const conditions = playbook.triggerConditions;

      // Check type match
      if (conditions.type !== alert.type) continue;

      // Check severity match
      if (!conditions.severity.includes(alert.severity)) continue;

      // Check platform match (if specified)
      if (conditions.platforms && conditions.platforms.length > 0) {
        const hasMatchingPlatform = conditions.platforms.some(p =>
          alert.affectedPlatforms.includes(p)
        );
        if (!hasMatchingPlatform) continue;
      }

      return playbook;
    }

    return null;
  }

  /**
   * Customize response with template
   */
  private customizeResponse(
    generated: string,
    template: string,
    alert: CrisisAlert
  ): string {
    // Replace template variables
    let customized = template
      .replace(/\{response\}/g, generated)
      .replace(/\{alert_type\}/g, alert.type)
      .replace(/\{severity\}/g, alert.severity)
      .replace(/\{description\}/g, alert.description);

    // Add narrative if available
    if (alert.narrative) {
      customized = customized.replace(/\{narrative\}/g, alert.narrative);
    }

    return customized;
  }

  /**
   * Create default playbooks
   */
  createDefaultPlaybooks(): void {
    // Sentiment spike playbook
    this.registerPlaybook({
      id: "sentiment-spike",
      name: "Sentiment Spike Response",
      triggerConditions: {
        type: "sentiment_spike",
        severity: ["medium", "high"],
      },
      responseTemplate: "We appreciate the feedback and want to address your concerns. {response}",
      autoApprove: false,
      platforms: ["twitter", "linkedin"],
      enabled: true,
    });

    // Negative narrative playbook
    this.registerPlaybook({
      id: "negative-narrative",
      name: "Negative Narrative Correction",
      triggerConditions: {
        type: "negative_narrative",
        severity: ["high", "critical"],
      },
      responseTemplate: "We'd like to provide accurate information: {response}",
      autoApprove: false,
      platforms: ["twitter", "linkedin", "reddit"],
      enabled: true,
    });

    // Coordinated attack playbook
    this.registerPlaybook({
      id: "coordinated-attack",
      name: "Coordinated Attack Response",
      triggerConditions: {
        type: "coordinated_attack",
        severity: ["critical"],
      },
      responseTemplate: "We are aware of coordinated misinformation. Here are the facts: {response}",
      autoApprove: false,
      platforms: ["twitter", "linkedin", "reddit", "forum"],
      enabled: true,
    });
  }
}
