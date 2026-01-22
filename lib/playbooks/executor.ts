/**
 * Playbook Executor
 * Executes playbook workflows with autopilot modes
 */

import { db } from "@/lib/db/client";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { ApprovalGateway } from "@/lib/engagement/approval-gateway";
import { DomainPublisher } from "@/lib/publishing/domain-publisher";
import { PADLDistributor } from "@/lib/publishing/padl-distributor";
import { logger } from "@/lib/logging/logger";

export interface PlaybookExecutionResult {
  execution_id: string;
  status: "completed" | "failed" | "pending_approval";
  result?: Record<string, unknown>;
  error?: string;
  approval_id?: string;
}

export class PlaybookExecutor {
  private aiOrchestrator: AIOrchestrator;
  private approvalGateway: ApprovalGateway;
  private domainPublisher: DomainPublisher;
  private padlDistributor: PADLDistributor;

  constructor() {
    const evidenceVault = new DatabaseEvidenceVault();
    this.aiOrchestrator = new AIOrchestrator(evidenceVault);
    this.approvalGateway = new ApprovalGateway();
    this.domainPublisher = new DomainPublisher();
    this.padlDistributor = new PADLDistributor();
  }

  /**
   * Execute playbook
   */
  async execute(
    playbookId: string,
    parameters: Record<string, unknown> = {}
  ): Promise<PlaybookExecutionResult> {
    const playbook = await db.playbook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      throw new Error("Playbook not found");
    }

    const template = playbook.template as Record<string, unknown>;
    const autopilotMode = playbook.autopilotMode;

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info("Executing playbook", {
        playbook_id: playbookId,
        playbook_name: playbook.name,
        template_type: template.type,
        autopilot_mode: autopilotMode,
        execution_id: executionId,
        tenant_id: playbook.tenantId,
      });

      // Execute based on template type
      const templateType = template.type as string || "default";

      let result: PlaybookExecutionResult;
      switch (templateType) {
        case "aaal_publish":
          result = await this.executeAAALPublish(playbook, parameters, autopilotMode);
          break;

        case "signal_response":
          result = await this.executeSignalResponse(playbook, parameters, autopilotMode);
          break;

        case "claim_analysis":
          result = await this.executeClaimAnalysis(playbook, parameters, autopilotMode);
          break;

        default:
          result = await this.executeGeneric(playbook, parameters, autopilotMode);
          break;
      }

      // Ensure execution_id is set
      result.execution_id = executionId;

      logger.info("Playbook execution completed", {
        playbook_id: playbookId,
        execution_id: executionId,
        status: result.status,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logger.error("Playbook execution failed", {
        playbook_id: playbookId,
        execution_id: executionId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        execution_id: executionId,
        status: "failed",
        error: errorMessage,
      };
    }
  }

  /**
   * Execute AAAL publish playbook
   */
  private async executeAAALPublish(
    playbook: any,
    parameters: Record<string, unknown>,
    autopilotMode: string
  ): Promise<PlaybookExecutionResult> {
    const artifactId = parameters.artifact_id as string;
    if (!artifactId) {
      throw new Error("artifact_id is required");
    }

    const artifact = await db.aAALArtifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) {
      throw new Error("Artifact not found");
    }

    // Check autopilot mode
    if (autopilotMode === "RECOMMEND_ONLY") {
      logger.info("AAAL publish playbook in RECOMMEND_ONLY mode", {
        artifact_id: artifactId,
        playbook_id: playbook.id,
      });
      return {
        execution_id: `exec-${Date.now()}`,
        status: "completed",
        result: {
          recommendation: "Publish artifact to PADL",
          artifact_id: artifactId,
          channels: ["padl"],
        },
      };
    }

    if (autopilotMode === "AUTO_ROUTE" || autopilotMode === "AUTO_PUBLISH") {
      // Request approval if needed
      if (autopilotMode === "AUTO_ROUTE") {
        const approval = await this.approvalGateway.requestApproval({
          resourceType: "AAAL_ARTIFACT",
          resourceId: artifactId,
          action: "publish",
          content: artifact.content as string,
          priority: "high",
        });

        if (approval.status !== "approved" && approval.decision !== "approved") {
          return {
            execution_id: `exec-${Date.now()}`,
            status: "pending_approval",
            approval_id: approval.id,
          };
        }
      }

      // Publish
      const publishedUrl = await this.domainPublisher.publish({
        artifactId,
        content: artifact.content as string,
        title: artifact.title,
        metadata: {},
      });

      // Distribute if configured
      if (parameters.channels) {
        const channels = parameters.channels as Array<"padl" | "medium" | "linkedin" | "substack" | "pr" | "social">;
        await this.padlDistributor.distribute({
          artifactId,
          content: artifact.content as string,
          title: artifact.title,
          channels,
        });
      }

      return {
        execution_id: `exec-${Date.now()}`,
        status: "completed",
        result: {
          published_url: publishedUrl,
          artifact_id: artifactId,
        },
      };
    }

    return {
      execution_id: `exec-${Date.now()}`,
      status: "completed",
      result: { message: "Playbook executed" },
    };
  }

  /**
   * Execute signal response playbook
   */
  private async executeSignalResponse(
    playbook: any,
    parameters: Record<string, unknown>,
    autopilotMode: string
  ): Promise<PlaybookExecutionResult> {
    const signalId = parameters.signal_id as string;
    if (!signalId) {
      throw new Error("signal_id parameter is required for signal_response playbook");
    }

    logger.info("Executing signal response playbook", {
      signal_id: signalId,
      playbook_id: playbook.id,
      autopilot_mode: autopilotMode,
    });

    // Generate response using AI orchestrator
    const response = await this.aiOrchestrator.orchestrate({
      query: `Generate a response to signal ${signalId}`,
      tenant_id: playbook.tenantId,
      use_rag: true,
      use_kag: true,
    });

    return {
      execution_id: `exec-${Date.now()}`,
      status: "completed",
      result: {
        response: response.response,
        citations: response.citations,
      },
    };
  }

  /**
   * Execute claim analysis playbook
   */
  private async executeClaimAnalysis(
    playbook: any,
    parameters: Record<string, unknown>,
    autopilotMode: string
  ): Promise<PlaybookExecutionResult> {
    const claimId = parameters.claim_id as string;
    if (!claimId) {
      throw new Error("claim_id parameter is required for claim_analysis playbook");
    }

    logger.info("Executing claim analysis playbook", {
      claim_id: claimId,
      playbook_id: playbook.id,
      autopilot_mode: autopilotMode,
    });

    // Analyze claim using AI
    const analysis = await this.aiOrchestrator.orchestrate({
      query: `Analyze claim ${claimId} and provide insights`,
      tenant_id: playbook.tenantId,
      use_rag: true,
      use_kag: true,
    });

    return {
      execution_id: `exec-${Date.now()}`,
      status: "completed",
      result: {
        analysis: analysis.response,
        citations: analysis.citations,
      },
    };
  }

  /**
   * Execute generic playbook
   */
  private async executeGeneric(
    playbook: any,
    parameters: Record<string, unknown>,
    autopilotMode: string
  ): Promise<PlaybookExecutionResult> {
    // Generic execution - just return success
    return {
      execution_id: `exec-${Date.now()}`,
      status: "completed",
      result: {
        message: "Playbook executed successfully",
        parameters,
      },
    };
  }
}
