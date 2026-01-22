/**
 * Approval Gateway
 * 
 * Human-gated approval system for autonomous operations.
 * Routes critical actions through approval workflows.
 */

export interface ApprovalRequest {
  resourceType: string;
  resourceId: string;
  action: string;
  content: string;
  context?: Record<string, unknown>;
  priority?: "low" | "medium" | "high" | "critical";
  requesterId?: string;
}

export interface Approval {
  id: string;
  request: ApprovalRequest;
  status: "pending" | "approved" | "rejected";
  decision?: "approved" | "rejected";
  approverId?: string;
  reason?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface ApprovalPolicy {
  resourceType: string;
  action: string;
  requiresApproval: boolean;
  autoApproveConditions?: {
    confidence?: number;
    riskLevel?: "low" | "medium" | "high";
    contentLength?: number;
  };
  approvers?: string[]; // User IDs or roles
}

export class ApprovalGateway {
  private policies: Map<string, ApprovalPolicy> = new Map();
  private pendingApprovals: Map<string, Approval> = new Map();

  constructor() {
    this.createDefaultPolicies();
  }

  /**
   * Create default approval policies
   */
  private createDefaultPolicies(): void {
    // Low-risk responses can auto-approve
    this.policies.set("forum_response:low", {
      resourceType: "forum_response",
      action: "publish",
      requiresApproval: false,
      autoApproveConditions: {
        confidence: 0.8,
        riskLevel: "low",
      },
    });

    // High-risk responses require approval
    this.policies.set("crisis_response:high", {
      resourceType: "crisis_response",
      action: "publish",
      requiresApproval: true,
      approvers: ["admin", "legal"],
    });

    // Comments require approval by default
    this.policies.set("comment:publish", {
      resourceType: "comment",
      action: "publish",
      requiresApproval: true,
    });

    // Social media posts require approval
    this.policies.set("social_post:publish", {
      resourceType: "social_post",
      action: "publish",
      requiresApproval: true,
    });
  }

  /**
   * Register approval policy
   */
  registerPolicy(policy: ApprovalPolicy): void {
    const key = `${policy.resourceType}:${policy.action}`;
    this.policies.set(key, policy);
  }

  /**
   * Request approval
   */
  async requestApproval(request: ApprovalRequest): Promise<Approval> {
    // Check if approval is required
    const policy = this.getPolicy(request.resourceType, request.action);

    if (!policy || !policy.requiresApproval) {
      // Check auto-approve conditions
      if (policy?.autoApproveConditions) {
        const canAutoApprove = await this.checkAutoApproveConditions(
          request,
          policy.autoApproveConditions
        );

        if (canAutoApprove) {
          return {
            id: crypto.randomUUID(),
            request,
            status: "approved",
            decision: "approved",
            createdAt: new Date().toISOString(),
            decidedAt: new Date().toISOString(),
          };
        }
      } else {
        // No policy means auto-approve
        return {
          id: crypto.randomUUID(),
          request,
          status: "approved",
          decision: "approved",
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        };
      }
    }

    // Create pending approval
    const approval: Approval = {
      id: crypto.randomUUID(),
      request,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    this.pendingApprovals.set(approval.id, approval);

    // In production, would:
    // 1. Notify approvers
    // 2. Create approval task
    // 3. Wait for decision

    // For now, return pending approval
    return approval;
  }

  /**
   * Get policy for resource type and action
   */
  private getPolicy(resourceType: string, action: string): ApprovalPolicy | null {
    const key = `${resourceType}:${action}`;
    return this.policies.get(key) || null;
  }

  /**
   * Check auto-approve conditions
   */
  private async checkAutoApproveConditions(
    request: ApprovalRequest,
    conditions: NonNullable<ApprovalPolicy["autoApproveConditions"]>
  ): Promise<boolean> {
    // Check confidence (calculated from content analysis)
    if (conditions.confidence !== undefined) {
      // Calculate confidence from content analysis
      const calculatedConfidence = await this.calculateConfidence(request);
      if (calculatedConfidence < conditions.confidence) {
        return false;
      }
    }

    // Check risk level
    if (conditions.riskLevel) {
      const requestRisk = request.priority === "critical" ? "high" :
                         request.priority === "high" ? "medium" : "low";
      
      const riskLevels = { low: 0, medium: 1, high: 2 };
      if (riskLevels[requestRisk] >= riskLevels[conditions.riskLevel]) {
        return false;
      }
    }

    // Check content length
    if (conditions.contentLength !== undefined) {
      if (request.content.length > conditions.contentLength) {
        return false;
      }
    }

    return true;
  }

  /**
   * Approve pending approval
   */
  async approve(approvalId: string, approverId: string, reason?: string): Promise<Approval> {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    approval.status = "approved";
    approval.decision = "approved";
    approval.approverId = approverId;
    approval.reason = reason;
    approval.decidedAt = new Date().toISOString();

    this.pendingApprovals.set(approvalId, approval);

    return approval;
  }

  /**
   * Reject pending approval
   */
  async reject(approvalId: string, approverId: string, reason: string): Promise<Approval> {
    const approval = this.pendingApprovals.get(approvalId);
    
    if (!approval) {
      throw new Error(`Approval ${approvalId} not found`);
    }

    approval.status = "rejected";
    approval.decision = "rejected";
    approval.approverId = approverId;
    approval.reason = reason;
    approval.decidedAt = new Date().toISOString();

    this.pendingApprovals.set(approvalId, approval);

    return approval;
  }

  /**
   * Get pending approvals
   */
  getPendingApprovals(): Approval[] {
    return Array.from(this.pendingApprovals.values())
      .filter(a => a.status === "pending")
      .sort((a, b) => {
        // Sort by priority
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.request.priority || "low"];
        const bPriority = priorityOrder[b.request.priority || "low"];
        return aPriority - bPriority;
      });
  }

  /**
   * Get approval by ID
   */
  getApproval(approvalId: string): Approval | null {
    return this.pendingApprovals.get(approvalId) || null;
  }

  /**
   * Calculate confidence score from content analysis
   */
  private async calculateConfidence(request: ApprovalRequest): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Factor 1: Content length (longer content = more context = higher confidence)
    const contentLength = request.content.length;
    if (contentLength > 500) {
      confidence += 0.1;
    } else if (contentLength < 50) {
      confidence -= 0.2;
    }

    // Factor 2: Context completeness
    if (request.context) {
      const contextKeys = Object.keys(request.context);
      if (contextKeys.length > 3) {
        confidence += 0.1;
      }
    }

    // Factor 3: Priority (higher priority = lower auto-approve confidence)
    const priorityWeights = { low: 0.1, medium: 0, high: -0.1, critical: -0.2 };
    confidence += priorityWeights[request.priority || "medium"] || 0;

    // Factor 4: Content quality indicators (basic heuristics)
    const hasStructure = /^#{1,3}\s|^\d+\.|^[-*]\s/.test(request.content);
    if (hasStructure) {
      confidence += 0.05;
    }

    const hasEvidence = /evidence|source|reference|citation/i.test(request.content);
    if (hasEvidence) {
      confidence += 0.1;
    }

    // Factor 5: Use AI-based confidence if available
    try {
      const { VectorEmbeddings } = await import("@/lib/search/embeddings");
      const embeddings = new VectorEmbeddings();
      const contentEmbedding = await embeddings.embed(request.content, { model: "openai" });
      
      // Higher dimensional embeddings suggest richer content
      if (contentEmbedding.vector.length > 512) {
        confidence += 0.05;
      }
    } catch (error) {
      // Fallback if embeddings unavailable
      console.warn("Confidence calculation: embeddings unavailable", error);
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }
}
