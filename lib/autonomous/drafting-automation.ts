/**
 * Autonomous Drafting Automation
 * 
 * Fully autonomous artifact drafting with human-gated publishing.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { ApprovalGateway } from "@/lib/engagement/approval-gateway";
import { TimelineBuilder } from "@/lib/capa/timeline-builder";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";

export interface DraftingResult {
  artifacts_drafted: number;
  approvals_required: number;
  errors: number;
  duration_ms: number;
}

export class DraftingAutomation {
  private approvalGateway: ApprovalGateway;
  private timelineBuilder: TimelineBuilder;
  private aiOrchestrator: AIOrchestrator;

  constructor() {
    this.approvalGateway = new ApprovalGateway();
    this.timelineBuilder = new TimelineBuilder();
    this.aiOrchestrator = new AIOrchestrator(new DatabaseEvidenceVault());
  }

  /**
   * Execute autonomous drafting
   */
  async execute(
    tenantId: string,
    workspaceId: string | undefined,
    enablePublishing: boolean
  ): Promise<DraftingResult> {
    const startTime = Date.now();
    let artifactsDrafted = 0;
    let approvalsRequired = 0;
    let errors = 0;

    try {
      // Get top claim clusters
      const clusters = await db.claimCluster.findMany({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { decisiveness: "desc" },
        take: 10,
        include: {
          primaryClaim: {
            include: {
              evidenceRefs: true,
            },
          },
        },
      });

      for (const cluster of clusters) {
        try {
          // Build timeline
          const timeline = await this.timelineBuilder.buildTimeline(cluster.id, tenantId);

          // Draft artifact using AI (autonomous)
          const evidenceIds = cluster.primaryClaim.evidenceRefs.map((r) => r.evidenceId);
          const artifactContent = await this.draftArtifactWithAI(
            cluster,
            timeline,
            evidenceIds
          );

          // Create artifact
          const artifact = await db.aAALArtifact.create({
            data: {
              tenantId,
              title: `Trust & Transparency: ${cluster.primaryClaim.canonicalText.substring(0, 100)}`,
              content: artifactContent,
              version: "1.0",
              status: "DRAFT",
              approvers: [],
              requiredApprovals: 2, // Legal + Comms
            },
          });

          // Link evidence
          for (const evidenceRef of cluster.primaryClaim.evidenceRefs.slice(0, 20)) {
            await db.aAALArtifactEvidence.create({
              data: {
                artifactId: artifact.id,
                evidenceId: evidenceRef.evidenceId,
              },
            });
          }

          artifactsDrafted++;

          // Request approval if publishing not enabled (human-gated)
          if (!enablePublishing) {
            const approval = await this.approvalGateway.requestApproval(
              {
                resourceType: "AAAL_ARTIFACT",
                resourceId: artifact.id,
                action: "publish",
                content: artifactContent,
                requesterId: "autonomous-system",
                workspaceId: workspaceId,
              },
              tenantId
            );

            if (approval.status === "pending") {
              approvalsRequired++;
            }
          }
        } catch (error) {
          errors++;
          logger.warn("Failed to draft artifact", {
            error: error instanceof Error ? error.message : String(error),
            cluster_id: cluster.id,
          });
        }
      }

      return {
        artifacts_drafted: artifactsDrafted,
        approvals_required: approvalsRequired,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Autonomous drafting failed", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        artifacts_drafted: artifactsDrafted,
        approvals_required: approvalsRequired,
        errors: errors + 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Draft artifact content using AI (autonomous)
   */
  private async draftArtifactWithAI(
    cluster: any,
    timeline: any,
    evidenceIds: string[]
  ): Promise<string> {
    try {
      const primaryClaimText = cluster.primaryClaim?.canonicalText || "Claim cluster";
      const prompt = `Create an authoritative, evidence-backed Trust & Transparency document that addresses the following claim cluster:

Primary Claim: ${primaryClaimText}

Timeline:
${timeline.entries.map((e: any) => `- ${e.timestamp}: ${e.title}`).join("\n")}

Evidence: ${evidenceIds.length} evidence items support this document.

Requirements:
1. Address the root claim directly
2. Provide verifiable, evidence-backed information
3. Include timeline of what changed
4. Offer concrete resolution paths
5. Be written for AI citation (structured, authoritative)
6. Be human-legible and transparent

Format as a comprehensive Trust & Transparency page.`;

      const result = await this.aiOrchestrator.orchestrate({
        query: prompt,
        tenant_id: cluster.tenantId,
        use_rag: true,
        use_kag: true,
      });

      return result.response;
    } catch (error) {
      logger.warn("AI drafting failed, using template", {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fallback to template
      return this.draftArtifactTemplate(cluster, timeline, evidenceIds);
    }
  }

  /**
   * Draft artifact template (fallback)
   */
  private draftArtifactTemplate(
    cluster: any,
    timeline: any,
    evidenceIds: string[]
  ): string {
    const primaryClaimText = cluster.primaryClaim?.canonicalText || "Claim cluster";
    return `# Trust & Transparency

## Overview
This document addresses claims about the organization with evidence-backed information.

## Primary Claim
${primaryClaimText}

## Timeline
${timeline.entries.map((e: any) => `- ${e.timestamp}: ${e.title}`).join("\n")}

## Evidence
This document is supported by ${evidenceIds.length} verifiable evidence items.

## What Changed
${timeline.entries.filter((e: any) => e.type === "change").map((e: any) => `- ${e.title}: ${e.description}`).join("\n")}

## Customer Protections
For customer concerns, please contact support through official channels.

## Sources
All claims in this document are backed by verifiable evidence.`;
  }
}
