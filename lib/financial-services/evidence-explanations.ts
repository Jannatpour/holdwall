/**
 * Financial Services Evidence-Backed Explanations
 * 
 * Generates multiple outputs from the same evidence spine:
 * - Public-facing explanation
 * - Internal risk brief
 * - Support playbooks
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { financialServicesMode } from "./operating-mode";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { metrics } from "@/lib/observability/metrics";

const evidenceVault = new DatabaseEvidenceVault();
const aiOrchestrator = new AIOrchestrator(evidenceVault);

export interface EvidenceExplanation {
  id: string;
  clusterId: string;
  publicExplanation: PublicExplanation;
  internalRiskBrief: InternalRiskBrief;
  supportPlaybooks: SupportPlaybook[];
  evidenceBundle: EvidenceBundle;
  createdAt: Date;
}

export interface PublicExplanation {
  title: string;
  summary: string;
  explanation: string;
  metrics: {
    issueCount: number;
    resolutionRate: number;
    averageResolutionTime: string;
  };
  policyReferences: string[];
  timeBoundUpdates: string[];
  structuredData: {
    "@context": string;
    "@type": string;
    name: string;
    description: string;
    datePublished: string;
  };
}

export interface InternalRiskBrief {
  rootCause: string;
  exposureAssessment: {
    customerImpact: number;
    regulatoryRisk: "low" | "medium" | "high";
    financialExposure: string;
  };
  regulatoryImplications: string[];
  recommendedActions: string[];
}

export interface SupportPlaybook {
  responseMacros: Array<{
    trigger: string;
    response: string;
  }>;
  deEscalationLanguage: string[];
  escalationCriteria: string[];
}

export interface EvidenceBundle {
  evidenceIds: string[];
  claimIds: string[];
  approvalTrail: Array<{
    approver: string;
    decision: string;
    timestamp: Date;
  }>;
  merkleRoot?: string; // For tamper-evident audits
}

export class FinancialServicesEvidenceExplanations {
  /**
   * Generate evidence-backed explanation for a narrative cluster
   */
  async generateExplanation(
    tenantId: string,
    clusterId: string
  ): Promise<EvidenceExplanation> {
    const cluster = await db.claimCluster.findUnique({
      where: { id: clusterId },
      include: {
        primaryClaim: {
          include: {
            evidenceRefs: {
              include: {
                evidence: true,
              },
            },
          },
        },
        claims: {
          include: {
            evidenceRefs: {
              include: {
                evidence: true,
              },
            },
          },
        },
      },
    });

    if (!cluster || cluster.tenantId !== tenantId) {
      throw new Error("Cluster not found");
    }

    // Collect all evidence
    const evidenceItems = new Set<string>();
    const claimIds: string[] = [];

    for (const claim of cluster.claims) {
      claimIds.push(claim.id);
      for (const evidenceRef of claim.evidenceRefs) {
        evidenceItems.add(evidenceRef.evidenceId);
      }
    }

    // Get evidence details
    const evidenceDetails = await db.evidence.findMany({
      where: {
        id: { in: Array.from(evidenceItems) },
      },
    });

    // Get approval trail
    const approvals = await db.approval.findMany({
      where: {
        tenantId,
        resourceType: "AAAL_ARTIFACT",
        decision: { not: null },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    const approvalTrail = approvals.map((a) => ({
      approver: a.approverId || "Unknown",
      decision: a.decision || "PENDING",
      timestamp: a.decidedAt || a.createdAt,
    }));

    // Generate public explanation using AI
    const publicExplanation = await this.generatePublicExplanation(
      tenantId,
      cluster,
      evidenceDetails
    );

    // Generate internal risk brief
    const internalRiskBrief = await this.generateInternalRiskBrief(
      tenantId,
      cluster,
      evidenceDetails
    );

    // Generate support playbooks
    const supportPlaybooks = await this.generateSupportPlaybooks(
      tenantId,
      cluster,
      evidenceDetails
    );

    // Create evidence bundle
    const evidenceBundle: EvidenceBundle = {
      evidenceIds: Array.from(evidenceItems),
      claimIds,
      approvalTrail,
    };

    const explanation: EvidenceExplanation = {
      id: `expl-${Date.now()}`,
      clusterId,
      publicExplanation,
      internalRiskBrief,
      supportPlaybooks: [supportPlaybooks],
      evidenceBundle,
      createdAt: new Date(),
    };

    logger.info("Generated Financial Services evidence-backed explanation", {
      tenantId,
      clusterId,
      evidenceCount: evidenceItems.size,
    });

    metrics.increment("financial_services_explanation_generated_total", {
      tenantId,
      clusterId,
    });

    return explanation;
  }

  /**
   * Generate public-facing explanation
   */
  private async generatePublicExplanation(
    tenantId: string,
    cluster: any,
    evidence: any[]
  ): Promise<PublicExplanation> {
    const config = await financialServicesMode.getConfig(tenantId);

    const prompt = `Generate a public-facing explanation for the following narrative cluster in a financial services context.

Primary Claim: ${cluster.primaryClaim.canonicalText}
Cluster Size: ${cluster.size} claims
Evidence Count: ${evidence.length}

Requirements:
- Clear, calm language appropriate for customers and regulators
- Transparent metrics (issue count, resolution rate, average resolution time)
- Policy references where applicable
- Time-bound updates showing responsiveness
- Structured data in JSON-LD format for AI citation

Evidence Summary:
${evidence
  .slice(0, 5)
  .map((e) => `- ${e.summary || e.content.substring(0, 200)}`)
  .join("\n")}

Generate a professional, trustworthy explanation that addresses concerns while maintaining regulatory compliance.`;

    const result = await aiOrchestrator.orchestrate({
      query: prompt,
      tenant_id: tenantId,
      model: "gpt-4",
      temperature: 0.3,
      max_tokens: 2000,
    });

    // Parse response (in production, use structured output)
    const explanationText = result.response || "";

    return {
      title: `Addressing ${cluster.primaryClaim.canonicalText.substring(0, 60)}...`,
      summary: explanationText.substring(0, 200),
      explanation: explanationText,
      metrics: {
        issueCount: cluster.size,
        resolutionRate: 0.85, // Would be calculated from actual data
        averageResolutionTime: "2.5 days",
      },
      policyReferences: [
        "Customer Protection Policy",
        "Dispute Resolution Procedures",
      ],
      timeBoundUpdates: [
        "Initial response within 24 hours",
        "Full investigation within 5 business days",
      ],
      structuredData: {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: cluster.primaryClaim.canonicalText,
        description: explanationText.substring(0, 500),
        datePublished: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate internal risk brief
   */
  private async generateInternalRiskBrief(
    tenantId: string,
    cluster: any,
    evidence: any[]
  ): Promise<InternalRiskBrief> {
    const prompt = `Generate an internal risk brief for financial services executives.

Primary Claim: ${cluster.primaryClaim.canonicalText}
Cluster Size: ${cluster.size} claims
Decisiveness: ${cluster.decisiveness}

Analyze:
1. Root cause of the narrative
2. Exposure assessment (customer impact, regulatory risk, financial exposure)
3. Regulatory implications
4. Recommended actions

Be concise and actionable for executive decision-making.`;

    const result = await aiOrchestrator.orchestrate({
      query: prompt,
      tenant_id: tenantId,
      model: "gpt-4",
      temperature: 0.2,
      max_tokens: 1500,
    });

    const briefText = result.response || "";

    return {
      rootCause: briefText.substring(0, 300),
      exposureAssessment: {
        customerImpact: cluster.size,
        regulatoryRisk: cluster.decisiveness > 0.7 ? "high" : "medium",
        financialExposure: "TBD", // Would be calculated from actual data
      },
      regulatoryImplications: [
        "Potential CFPB inquiry if not addressed",
        "May trigger internal audit requirements",
      ],
      recommendedActions: [
        "Publish authoritative explanation within 48 hours",
        "Route to Legal for compliance review",
        "Monitor narrative velocity for escalation",
      ],
    };
  }

  /**
   * Generate support playbooks
   */
  private async generateSupportPlaybooks(
    tenantId: string,
    cluster: any,
    evidence: any[]
  ): Promise<SupportPlaybook> {
    return {
      responseMacros: [
        {
          trigger: "account_freeze",
          response:
            "We understand your concern about account access. Our security measures are designed to protect your account. Please contact our support team at [phone] for immediate assistance.",
        },
        {
          trigger: "transaction_failure",
          response:
            "We apologize for the inconvenience. Transaction issues are typically resolved within 24-48 hours. Our team is investigating and will provide updates.",
        },
      ],
      deEscalationLanguage: [
        "We take your concerns seriously",
        "Our team is actively working to resolve this",
        "We appreciate your patience",
      ],
      escalationCriteria: [
        "Customer mentions legal action",
        "Regulatory complaint filed",
        "Media inquiry received",
      ],
    };
  }

  /**
   * Create AAAL artifact from explanation
   */
  async createAAALArtifact(
    tenantId: string,
    explanation: EvidenceExplanation
  ): Promise<string> {
    const artifact = await db.aAALArtifact.create({
      data: {
        tenantId,
        title: explanation.publicExplanation.title,
        content: explanation.publicExplanation.explanation,
        version: "1.0.0",
        status: "DRAFT",
        approvers: [],
        requiredApprovals: 0,
        policyChecks: {
          clusterId: explanation.clusterId,
          evidenceCount: explanation.evidenceBundle.evidenceIds.length,
          generatedAt: explanation.createdAt.toISOString(),
          structuredData: explanation.publicExplanation.structuredData,
        } as any,
      },
    });

    // Create approval request if legal approval required
    const config = await financialServicesMode.getConfig(tenantId);
    if (config.legalApprovalRequired) {
      await db.approval.create({
        data: {
          tenantId,
          resourceType: "AAAL_ARTIFACT",
          resourceId: artifact.id,
          action: "PUBLISH",
          requesterId: tenantId, // Would be actual user ID
          approvers: ["Legal", "Compliance"],
          artifactId: artifact.id,
        },
      });
    }

    logger.info("Created AAAL artifact from Financial Services explanation", {
      tenantId,
      artifactId: artifact.id,
      clusterId: explanation.clusterId,
    });

    return artifact.id;
  }
}

export const evidenceExplanations = new FinancialServicesEvidenceExplanations();
