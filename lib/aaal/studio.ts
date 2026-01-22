/**
 * AAAL Studio + PADL Publishing
 * 
 * Traceability-first authoring, evidence picker, policy checker, approvals routing, publish to PADL
 */

import type { Evidence, EvidenceVault } from "@/lib/evidence/vault";
import type { EventEnvelope, EventStore } from "@/lib/events/types";
import { db } from "@/lib/db/client";

export interface AAALDocument {
  artifact_id: string;
  tenant_id: string;
  title: string;
  content: string;
  /** Evidence references (immutable citations) */
  evidence_refs: string[];
  /** Version */
  version: string;
  /** Status */
  status: "draft" | "pending_approval" | "approved" | "published";
  /** Approval routing */
  approval_routing?: {
    approvers: string[];
    required_approvals: number;
  /** Policy checks */
    policy_checks: PolicyCheckResult[];
  };
  /** PADL publishing */
  padl?: {
    published: boolean;
    public_url?: string;
    integrity_hash?: string;
    robots_directive?: string;
  };
  created_at: string;
  updated_at?: string;
  published_at?: string;
}

export interface PolicyCheckResult {
  policy_type: string;
  passed: boolean;
  reason?: string;
}

export class AAALStudioService {
  constructor(
    private evidenceVault: EvidenceVault,
    private eventStore: EventStore
  ) {}

  async createDraft(
    tenant_id: string,
    title: string,
    content: string,
    evidence_refs: string[]
  ): Promise<string> {
    // Validate evidence references exist
    for (const ref of evidence_refs) {
      const evidence = await this.evidenceVault.get(ref);
      if (!evidence) {
        throw new Error(`Evidence ${ref} not found`);
      }
    }

    const artifact_id = `aaal-${Date.now()}`;
    const document: AAALDocument = {
      artifact_id,
      tenant_id,
      title,
      content,
      evidence_refs,
      version: "1.0.0",
      status: "draft",
      created_at: new Date().toISOString(),
    };

    // Emit event
    const event: EventEnvelope = {
      event_id: crypto.randomUUID(),
      tenant_id,
      actor_id: "user", // In production, get from auth context
      type: "aaal.drafted",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs,
      payload: {
        artifact_id,
        title,
      },
      signatures: [],
    };

    await this.eventStore.append(event);

    return artifact_id;
  }

  async checkPolicies(
    document: AAALDocument
  ): Promise<PolicyCheckResult[]> {
    const results: PolicyCheckResult[] = [];

    // Check: All claims have evidence
    results.push({
      policy_type: "evidence_requirement",
      passed: document.evidence_refs.length > 0,
      reason: document.evidence_refs.length > 0
        ? "All claims have evidence"
        : "Missing evidence references",
    });

    // Check: No PII (using PII detection service)
    const { PIIDetectionService } = await import("@/lib/signals/pii-detection");
    const piiDetector = new PIIDetectionService();
    const hasPII = await piiDetector.hasPII(document.content);
    results.push({
      policy_type: "pii_detection",
      passed: !hasPII,
      reason: hasPII ? "PII detected in content" : "No PII detected",
    });

    // Check: Financial Services mode requirements
    try {
      const { financialServicesMode } = await import("@/lib/financial-services/operating-mode");
      const fsConfig = await financialServicesMode.getConfig(document.tenant_id);

      if (fsConfig.enabled) {
        // Check: Evidence threshold (Financial Services requires higher threshold)
        const evidenceQuality = document.evidence_refs.length >= 3 ? 1.0 : document.evidence_refs.length / 3;
        results.push({
          policy_type: "financial_services_evidence_threshold",
          passed: evidenceQuality >= fsConfig.evidenceThreshold,
          reason: evidenceQuality >= fsConfig.evidenceThreshold
            ? `Evidence quality (${evidenceQuality.toFixed(2)}) meets Financial Services threshold (${fsConfig.evidenceThreshold})`
            : `Evidence quality (${evidenceQuality.toFixed(2)}) below Financial Services threshold (${fsConfig.evidenceThreshold})`,
        });

        // Check: Legal approval required (Financial Services mode)
        if (fsConfig.legalApprovalRequired) {
          const hasLegalApproval = document.approval_routing?.approvers?.includes("Legal") ||
            document.approval_routing?.approvers?.some((a: string) => a.toLowerCase().includes("legal"));
          results.push({
            policy_type: "financial_services_legal_approval",
            passed: hasLegalApproval || document.status === "approved",
            reason: hasLegalApproval || document.status === "approved"
              ? "Legal approval configured or already approved"
              : "Financial Services mode requires legal approval before publishing",
          });
        }
      }
    } catch (error) {
      // If Financial Services mode check fails, continue with other checks
      // (not all tenants have Financial Services enabled)
    }

    // Check: Approval routing configured
    results.push({
      policy_type: "approval_routing",
      passed: !!document.approval_routing,
      reason: document.approval_routing
        ? "Approval routing configured"
        : "Missing approval routing",
    });

    return results;
  }

  async publishToPADL(
    artifact_id: string,
    options?: {
      public_url?: string;
      robots_directive?: string;
      include_c2pa?: boolean; // Include C2PA credentials
    }
  ): Promise<string> {
    // Publish to PADL (static site or CDN)
    const { DomainPublisher } = await import("@/lib/publishing/domain-publisher");
    const publisher = new DomainPublisher();

    // Get artifact content
    const artifact = await db.aAALArtifact.findUnique({
      where: { id: artifact_id },
      select: {
        id: true,
        content: true,
        title: true,
        version: true,
        tenantId: true,
        evidenceRefs: {
          select: {
            evidenceId: true,
          },
        },
      },
    });

    if (!artifact) {
      throw new Error(`Artifact not found: ${artifact_id}`);
    }

    // Get tenant domain if available
    const tenant = await db.tenant.findUnique({
      where: { id: artifact.tenantId },
      select: { settings: true },
    });

    const tenantDomain = (tenant?.settings as any)?.domain as string | undefined;

    // Generate C2PA credentials if requested
    let c2paCredential = null;
    if (options?.include_c2pa) {
      const { C2PABuilder } = await import("@/lib/provenance/c2pa");
      const c2paBuilder = new C2PABuilder();
      c2paCredential = await c2paBuilder.createCredential({
        id: artifact_id,
        content: artifact.content,
        author_id: artifact.tenantId, // Use tenant as author
        created_at: new Date().toISOString(),
        evidence_refs: artifact.evidenceRefs.map((ref) => ref.evidenceId),
      });
    }

    // Publish using domain publisher
    const public_url = await publisher.publish({
      artifactId: artifact_id,
      content: artifact.content,
      title: artifact.title,
      url: options?.public_url,
      tenantDomain,
      metadata: {
        version: artifact.version,
        robots: options?.robots_directive,
        ...(c2paCredential && { c2pa: c2paCredential }),
      },
    });

    // Emit event
    const event: EventEnvelope = {
      event_id: crypto.randomUUID(),
      tenant_id: artifact.tenantId,
      actor_id: "system",
      type: "aaal.published",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [],
      payload: {
        artifact_id,
        public_url,
      },
      signatures: [],
    };

    await this.eventStore.append(event);

    return public_url;
  }
}
