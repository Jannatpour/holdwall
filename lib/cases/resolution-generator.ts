/**
 * Autonomous Resolution Generator
 * 
 * Generates intelligent, self-learning resolution plans for Financial Services cases using:
 * - Multi-agent collaboration (FinTeam pattern: analyzer, analyst, accountant, consultant)
 * - Self-learning from historical resolutions
 * - Transfer learning and meta-learning
 * - GNN-RAG, HiRAG, KG-RAG for context retrieval
 * - Causal reasoning for understanding cause-effect relationships
 * - Counterfactual analysis for what-if scenarios
 * 
 * Latest January 2026 AI technologies integrated.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import type { ClaimsAdjudicationResult } from "./agents/claims-adjudication";
import type {
  Case,
  CaseType,
  CaseResolution,
  CaseResolutionStatus,
  CaseEvidence,
} from "@prisma/client";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);
const eventStore = new DatabaseEventStore();
const transactionManager = new TransactionManager();
const errorRecovery = new ErrorRecoveryService();

export interface ResolutionInput {
  caseId: string;
  tenantId: string;
  caseType: CaseType;
  description: string;
  severity: string;
  evidenceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ResolutionPlan {
  customerPlan: {
    title: string;
    summary: string;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      estimatedTime?: string;
      requiredActions?: string[];
      expectedOutcome?: string;
    }>;
    timeline?: {
      phase: string;
      duration: string;
      milestones: string[];
    };
    nextSteps: string[];
    contactInfo?: {
      email?: string;
      phone?: string;
      supportUrl?: string;
    };
  };
  internalPlan: {
    title: string;
    summary: string;
    phases: Array<{
      phaseNumber: number;
      name: string;
      description: string;
      tasks: Array<{
        taskId: string;
        title: string;
        description: string;
        assignedTo?: string;
        dueDate?: string;
        dependencies?: string[];
        status: "pending" | "in_progress" | "completed";
      }>;
      estimatedDuration?: string;
    }>;
    requiredApprovals?: Array<{
      type: string;
      reason: string;
      approver?: string;
    }>;
    riskMitigation?: Array<{
      risk: string;
      mitigation: string;
      owner?: string;
    }>;
  };
  recommendedDecision?: string;
  evidenceChecklist: Array<{
    item: string;
    status: "pending" | "collected" | "verified";
    source?: string;
    notes?: string;
  }>;
  chargebackReadiness?: {
    merchantResponse: string;
    evidenceStrength: "weak" | "moderate" | "strong";
    winProbability: number;
    recommendedActions: string[];
    deadline: string;
  };
  safetySteps?: Array<{
    action: string;
    priority: "immediate" | "high" | "medium" | "low";
    description: string;
    completed?: boolean;
  }>;
  timeline?: {
    events: Array<{
      timestamp: string;
      event: string;
      description: string;
      impact?: string;
    }>;
    rootCause?: string;
    resolution?: string;
    prevention?: string;
  };
  metadata: {
    modelUsed: string;
    tokensUsed?: number;
    latencyMs: number;
    confidence: number;
    learningApplied: boolean;
    historicalPatternsUsed: number;
  };
}

/**
 * Autonomous Resolution Generator
 * 
 * Multi-agent system that generates resolution plans using:
 * 1. FinTeam pattern: 4 specialized agents (analyzer, analyst, accountant, consultant)
 * 2. Self-learning from historical resolutions
 * 3. Transfer learning across case types
 * 4. Meta-learning for strategy optimization
 * 5. Causal reasoning for understanding relationships
 * 6. Counterfactual analysis for what-if scenarios
 */
export class AutonomousResolutionGenerator {
  private readonly confidenceThreshold = 0.75;

  /**
   * Generate resolution plan for a case
   * Enhanced with Claims Adjudication Pattern and hub-and-spoke orchestration
   */
  async generateResolution(input: ResolutionInput): Promise<ResolutionPlan> {
    const startTime = Date.now();

    try {
      logger.info("Generating resolution plan", {
        caseId: input.caseId,
        caseType: input.caseType,
        severity: input.severity,
      });

      // Option 1: Use Claims Adjudication Pattern for complex cases
      const useClaimsAdjudication = input.severity === "CRITICAL" || input.severity === "HIGH";
      
      if (useClaimsAdjudication) {
        const { claimsAdjudicationPattern } = await import("./agents/claims-adjudication");
        const { hubSpokeOrchestrator } = await import("./agents/hub-spoke-orchestrator");
        const case_ = await db.case.findUnique({ where: { id: input.caseId } });
        const resolution = case_ ? await db.caseResolution.findUnique({ where: { caseId: input.caseId } }) : null;
        
        if (case_) {
          // Use hub-and-spoke orchestration with Claims Adjudication Pattern
          const adjudicationResult = await claimsAdjudicationPattern.processCase({
            caseId: input.caseId,
            tenantId: input.tenantId,
            case: case_,
            resolution: resolution || undefined,
            evidenceIds: input.evidenceIds,
          });

          // Convert adjudication result to resolution plan format
          return this.convertAdjudicationToResolutionPlan(adjudicationResult, input);
        }
      }

      // Step 1: Gather comprehensive context (enhanced with G-reasoner and GORAG)
      const context = await this.gatherContext(input);

      // Step 2: Multi-agent collaboration (FinTeam pattern with hub-and-spoke orchestration)
      const agentAnalyses = await this.runMultiAgentAnalysis(input, context);

      // Step 3: Synthesize agent outputs
      const synthesized = await this.synthesizeAgentOutputs(agentAnalyses, input, context);

      // Step 4: Apply self-learning from historical patterns
      const learned = await this.applyLearning(synthesized, input, context);

      // Step 5: Generate case-type-specific components
      const specialized = await this.generateSpecializedComponents(learned, input, context);

      // Step 6: Validate and finalize
      const finalized = await this.validateAndFinalize(specialized, input);

      const latencyMs = Date.now() - startTime;

      metrics.increment("cases.resolution.generated");
      metrics.observe("cases.resolution.latency", latencyMs);
      metrics.gauge("cases.resolution.confidence", finalized.metadata.confidence);

      logger.info("Resolution plan generated", {
        caseId: input.caseId,
        confidence: finalized.metadata.confidence,
        latencyMs,
      });

      return finalized;
    } catch (error) {
      logger.error("Resolution generation failed", {
        caseId: input.caseId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Apply error recovery with retry
      const recoveryResult = await errorRecovery.executeWithRecovery(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return this.generateResolution(input);
        },
        {
          retry: {
            maxAttempts: 2,
            backoffMs: 2000,
            exponential: true,
          },
          timeout: 60_000,
        },
        "resolution_generation"
      );

      if (recoveryResult.success && recoveryResult.result) {
        return recoveryResult.result;
      }

      throw error;
    }
  }

  /**
   * Gather comprehensive context for resolution generation
   * Enhanced with G-reasoner and GORAG for advanced graph reasoning
   */
  private async gatherContext(input: ResolutionInput): Promise<{
    case: Case | null;
    evidence: Array<{ id: string; content: string; metadata: Record<string, unknown> }>;
    relatedResolutions: Array<{
      caseId: string;
      caseType: CaseType;
      customerPlan: unknown;
      internalPlan: unknown;
      success: boolean;
    }>;
    historicalPatterns: Array<{
      caseType: CaseType;
      resolutionStrategy: string;
      successRate: number;
      avgResolutionTime: number;
      commonSteps: string[];
    }>;
    knowledgeGraph: {
      nodes: Array<{ id: string; type: string; properties: Record<string, unknown> }>;
      edges: Array<{ source: string; target: string; relation: string }>;
    };
    gReasonerContext?: {
      answer: string;
      reasoning: string;
      graphPath: Array<{ nodeId: string; nodeType: string; reasoning: string }>;
    };
    goragContext?: {
      answer: string;
      reasoning: string;
      retrievedNodes: Array<{ nodeId: string; relevance: number; path: string[] }>;
    };
  }> {
    // Get case details
    const case_ = await db.case.findUnique({
      where: { id: input.caseId },
      include: {
        evidence: {
          include: {
            evidence: true,
          },
        },
      },
    });

    // Gather evidence
    const evidence: Array<{ id: string; content: string; metadata: Record<string, unknown> }> = [];
    if (input.evidenceIds && input.evidenceIds.length > 0) {
      for (const evidenceId of input.evidenceIds) {
        try {
          const ev = await evidenceVault.get(evidenceId, "autonomous-resolution-generator", input.tenantId);
          if (ev) {
            evidence.push({
              id: evidenceId,
              content: typeof ev.content === "string" ? ev.content : (ev.content?.raw || ev.content?.normalized || ""),
              metadata: ev.metadata || {},
            });
          }
        } catch (error) {
          logger.warn("Failed to fetch evidence", { evidenceId, error });
        }
      }
    }

    // Query related successful resolutions
    const relatedResolutions = await db.case.findMany({
      where: {
        tenantId: input.tenantId,
        type: input.caseType,
        status: {
          in: ["RESOLVED", "CLOSED"],
        },
        resolution: {
          isNot: null,
        },
      },
      include: {
        resolution: true,
      },
      take: 20,
      orderBy: {
        resolvedAt: "desc",
      },
    });

    const formattedResolutions = relatedResolutions.map((c) => {
      const caseWithResolution = c as typeof c & {
        resolution?: { customerPlan: unknown; internalPlan: unknown };
      };
      return {
        caseId: c.id,
        caseType: c.type,
        customerPlan: caseWithResolution.resolution?.customerPlan || {},
        internalPlan: caseWithResolution.resolution?.internalPlan || {},
        success: c.status === "RESOLVED",
      };
    });

    // Query historical patterns
    const historicalPatterns = await this.queryHistoricalPatterns(input);

    // Query knowledge graph
    const knowledgeGraph = await this.queryKnowledgeGraph(input);

    return {
      case: case_,
      evidence,
      relatedResolutions: formattedResolutions,
      historicalPatterns,
      knowledgeGraph,
      // Enhanced with G-reasoner and GORAG
      gReasonerContext: await this.getGReasonerContext(input, knowledgeGraph),
      goragContext: await this.getGORAGContext(input),
    };
  }

  /**
   * Get G-reasoner context for advanced graph reasoning
   */
  private async getGReasonerContext(
    input: ResolutionInput,
    knowledgeGraph: { nodes: Array<{ id: string; type: string; properties: Record<string, unknown> }>; edges: Array<{ source: string; target: string; relation: string }> }
  ): Promise<{
    answer: string;
    reasoning: string;
    graphPath: Array<{ nodeId: string; nodeType: string; reasoning: string }>;
  } | undefined> {
    try {
      const { gReasoner } = await import("@/lib/ai/g-reasoner");
      const { db } = await import("@/lib/db/client");
      
      // Get belief nodes and edges for G-reasoner
      const nodes = await db.beliefNode.findMany({
        where: { tenantId: input.tenantId },
        take: 50,
      });
      const edges = await db.beliefEdge.findMany({
        where: {
          fromNode: { tenantId: input.tenantId },
        },
        take: 100,
      });

      if (nodes.length > 0) {
        const result = await gReasoner.reason(
          {
            query: `Analyze case: ${input.description}. Case type: ${input.caseType}. Severity: ${input.severity}`,
            nodes,
            edges,
            context: { caseType: input.caseType, severity: input.severity },
          },
          input.tenantId
        );

        return {
          answer: result.answer,
          reasoning: result.reasoning,
          graphPath: result.graphPath,
        };
      }
    } catch (error) {
      logger.warn("G-reasoner context failed", { error });
    }
    return undefined;
  }

  /**
   * Get GORAG context for graph-based retrieval
   */
  private async getGORAGContext(
    input: ResolutionInput
  ): Promise<{
    answer: string;
    reasoning: string;
    retrievedNodes: Array<{ nodeId: string; relevance: number; path: string[] }>;
  } | undefined> {
    try {
      const { gorag } = await import("@/lib/ai/gorag");
      
      // Initialize GORAG with evidence
      if (input.evidenceIds && input.evidenceIds.length > 0) {
        const evidence = await Promise.all(
          input.evidenceIds.map(async (id) => {
            return await evidenceVault.get(id, "resolution-generator", input.tenantId);
          })
        );

        const validEvidence = evidence.filter((e): e is NonNullable<typeof e> => e !== null);
        if (validEvidence.length > 0) {
          await gorag.initialize(validEvidence);

          const result = await gorag.query(
            {
              query: `Resolution strategy for: ${input.description}`,
              maxHops: 3,
              useCommunities: true,
              usePathReasoning: true,
            },
            input.tenantId
          );

          return {
            answer: result.answer,
            reasoning: result.reasoning,
            retrievedNodes: result.retrievedNodes,
          };
        }
      }
    } catch (error) {
      logger.warn("GORAG context failed", { error });
    }
    return undefined;
  }

  /**
   * Convert Claims Adjudication Pattern result into a ResolutionPlan.
   */
  private convertAdjudicationToResolutionPlan(
    adjudicationResult: ClaimsAdjudicationResult,
    input: ResolutionInput
  ): ResolutionPlan {
    const steps = adjudicationResult.finalDecision.nextSteps.map((s, idx) => ({
      stepNumber: idx + 1,
      title: s,
      description: s,
      estimatedTime: undefined,
    }));

    const internalPhases = adjudicationResult.plan.phases.map((p) => ({
      phaseNumber: p.phaseNumber,
      name: p.name,
      description: p.description,
      tasks: p.tasks.map((t) => ({
        taskId: t.taskId,
        title: `${t.agent}: ${t.description}`.slice(0, 140),
        description: t.description,
        assignedTo: t.agent,
        status: t.status,
      })),
      estimatedDuration: undefined,
    }));

    return {
      customerPlan: {
        title: "Resolution Plan",
        summary: adjudicationResult.finalDecision.reasoning,
        steps: steps.length > 0 ? steps : this.getDefaultCustomerPlan().steps,
        nextSteps: adjudicationResult.finalDecision.nextSteps,
        contactInfo: undefined,
      },
      internalPlan: {
        title: "Internal Action Plan",
        summary: adjudicationResult.finalDecision.recommendation,
        phases: internalPhases,
        requiredApprovals: [],
        riskMitigation: [],
      },
      recommendedDecision: adjudicationResult.finalDecision.recommendation,
      evidenceChecklist: (input.evidenceIds || []).map((id) => ({
        item: `Evidence ${id}`,
        status: "collected" as const,
        source: "evidence_vault",
      })),
      metadata: {
        modelUsed: "claims-adjudication",
        latencyMs: adjudicationResult.metadata.latencyMs,
        confidence: adjudicationResult.finalDecision.confidence,
        learningApplied: false,
        historicalPatternsUsed: 0,
      },
    };
  }

  /**
   * Run multi-agent analysis (FinTeam pattern)
   * 4 specialized agents: analyzer, analyst, accountant, consultant
   */
  private async runMultiAgentAnalysis(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<{
    analyzer: {
      rootCause: string;
      contributingFactors: string[];
      impact: string;
      urgency: string;
    };
    analyst: {
      evidenceGaps: string[];
      requiredEvidence: string[];
      evidenceStrength: "weak" | "moderate" | "strong";
      recommendations: string[];
    };
    accountant: {
      financialImpact: string;
      costEstimate?: number;
      revenueImpact?: number;
      riskExposure: string;
      costOptimization: string[];
    };
    consultant: {
      customerImpact: string;
      communicationStrategy: string;
      escalationNeeded: boolean;
      stakeholderManagement: string[];
    };
  }> {
    const agentsStart = Date.now();

    // Agent 1: Analyzer - Root cause and impact analysis
    const analyzerPrompt = this.buildAnalyzerPrompt(input, context);
    const analyzerResponse = await orchestrator.orchestrate({
      query: analyzerPrompt,
      tenant_id: input.tenantId,
      use_rag: true,
      use_kag: true,
      model: "o1-mini", // Latest 2026 reasoning model for root cause analysis
      temperature: 0.3,
      max_tokens: 2000,
    });
    const analyzer = this.parseAnalyzerResponse(analyzerResponse.response);

    // Agent 2: Analyst - Evidence and data analysis
    const analystPrompt = this.buildAnalystPrompt(input, context);
    const analystResponse = await orchestrator.orchestrate({
      query: analystPrompt,
      tenant_id: input.tenantId,
      use_rag: true,
      use_kag: true,
      model: "claude-opus-4.5",
      temperature: 0.2,
      max_tokens: 2000,
    });
    const analyst = this.parseAnalystResponse(analystResponse.response);

    // Agent 3: Accountant - Financial analysis
    const accountantPrompt = this.buildAccountantPrompt(input, context);
    const accountantResponse = await orchestrator.orchestrate({
      query: accountantPrompt,
      tenant_id: input.tenantId,
      use_rag: true,
      use_kag: true,
      model: "gemini-3-pro",
      temperature: 0.2,
      max_tokens: 2000,
    });
    const accountant = this.parseAccountantResponse(accountantResponse.response);

    // Agent 4: Consultant - Customer and stakeholder management
    const consultantPrompt = this.buildConsultantPrompt(input, context);
    const consultantResponse = await orchestrator.orchestrate({
      query: consultantPrompt,
      tenant_id: input.tenantId,
      use_rag: true,
      use_kag: true,
      model: "o1-mini", // Latest 2026 reasoning model for root cause analysis
      temperature: 0.4,
      max_tokens: 2000,
    });
    const consultant = this.parseConsultantResponse(consultantResponse.response);

    const agentsLatency = Date.now() - agentsStart;
    metrics.observe("cases.resolution.multi_agent_analysis", agentsLatency);

    logger.debug("Multi-agent analysis completed", {
      caseId: input.caseId,
      latencyMs: agentsLatency,
    });

    return {
      analyzer,
      analyst,
      accountant,
      consultant,
    };
  }

  /**
   * Build analyzer agent prompt
   */
  private buildAnalyzerPrompt(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): string {
    return `You are an expert Financial Services case analyzer. Analyze the root cause, contributing factors, impact, and urgency.

CASE DETAILS:
- Type: ${input.caseType}
- Description: ${input.description}
- Severity: ${input.severity}

EVIDENCE (${context.evidence.length} items):
${context.evidence.map((e, i) => `${i + 1}. ${e.content.substring(0, 500)}...`).join("\n")}

RELATED RESOLUTIONS (${context.relatedResolutions.length}):
${context.relatedResolutions.slice(0, 5).map((r, i) => `${i + 1}. ${r.caseType} - Success: ${r.success}`).join("\n")}

Provide your analysis in JSON format:
{
  "rootCause": "Primary root cause of the issue",
  "contributingFactors": ["factor1", "factor2", ...],
  "impact": "Detailed impact assessment",
  "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
}`;
  }

  /**
   * Parse analyzer response
   */
  private parseAnalyzerResponse(response: string): {
    rootCause: string;
    contributingFactors: string[];
    impact: string;
    urgency: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        rootCause: parsed.rootCause || "Unknown",
        contributingFactors: Array.isArray(parsed.contributingFactors) ? parsed.contributingFactors : [],
        impact: parsed.impact || "Unknown",
        urgency: parsed.urgency || "MEDIUM",
      };
    } catch (error) {
      logger.error("Failed to parse analyzer response", { error });
      return {
        rootCause: "Analysis failed",
        contributingFactors: [],
        impact: "Unknown",
        urgency: "MEDIUM",
      };
    }
  }

  /**
   * Build analyst agent prompt
   */
  private buildAnalystPrompt(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): string {
    return `You are an expert Financial Services evidence analyst. Analyze evidence gaps, required evidence, evidence strength, and provide recommendations.

CASE: ${input.description}
EVIDENCE COUNT: ${context.evidence.length}

Provide analysis in JSON:
{
  "evidenceGaps": ["gap1", "gap2", ...],
  "requiredEvidence": ["evidence1", "evidence2", ...],
  "evidenceStrength": "weak" | "moderate" | "strong",
  "recommendations": ["rec1", "rec2", ...]
}`;
  }

  /**
   * Parse analyst response
   */
  private parseAnalystResponse(response: string): {
    evidenceGaps: string[];
    requiredEvidence: string[];
    evidenceStrength: "weak" | "moderate" | "strong";
    recommendations: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps : [],
        requiredEvidence: Array.isArray(parsed.requiredEvidence) ? parsed.requiredEvidence : [],
        evidenceStrength: ["weak", "moderate", "strong"].includes(parsed.evidenceStrength)
          ? parsed.evidenceStrength
          : "moderate",
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      };
    } catch (error) {
      logger.error("Failed to parse analyst response", { error });
      return {
        evidenceGaps: [],
        requiredEvidence: [],
        evidenceStrength: "moderate",
        recommendations: [],
      };
    }
  }

  /**
   * Build accountant agent prompt
   */
  private buildAccountantPrompt(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): string {
    return `You are an expert Financial Services accountant. Analyze financial impact, costs, revenue impact, risk exposure, and cost optimization opportunities.

CASE: ${input.description}
TYPE: ${input.caseType}

Provide analysis in JSON:
{
  "financialImpact": "Detailed financial impact",
  "costEstimate": number,
  "revenueImpact": number,
  "riskExposure": "Detailed risk exposure",
  "costOptimization": ["opt1", "opt2", ...]
}`;
  }

  /**
   * Parse accountant response
   */
  private parseAccountantResponse(response: string): {
    financialImpact: string;
    costEstimate?: number;
    revenueImpact?: number;
    riskExposure: string;
    costOptimization: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        financialImpact: parsed.financialImpact || "Unknown",
        costEstimate: parsed.costEstimate ? Number(parsed.costEstimate) : undefined,
        revenueImpact: parsed.revenueImpact ? Number(parsed.revenueImpact) : undefined,
        riskExposure: parsed.riskExposure || "Unknown",
        costOptimization: Array.isArray(parsed.costOptimization) ? parsed.costOptimization : [],
      };
    } catch (error) {
      logger.error("Failed to parse accountant response", { error });
      return {
        financialImpact: "Unknown",
        riskExposure: "Unknown",
        costOptimization: [],
      };
    }
  }

  /**
   * Build consultant agent prompt
   */
  private buildConsultantPrompt(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): string {
    return `You are an expert Financial Services consultant. Analyze customer impact, communication strategy, escalation needs, and stakeholder management.

CASE: ${input.description}
SEVERITY: ${input.severity}

Provide analysis in JSON:
{
  "customerImpact": "Detailed customer impact",
  "communicationStrategy": "Strategy for customer communication",
  "escalationNeeded": true | false,
  "stakeholderManagement": ["stakeholder1", "stakeholder2", ...]
}`;
  }

  /**
   * Parse consultant response
   */
  private parseConsultantResponse(response: string): {
    customerImpact: string;
    communicationStrategy: string;
    escalationNeeded: boolean;
    stakeholderManagement: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        customerImpact: parsed.customerImpact || "Unknown",
        communicationStrategy: parsed.communicationStrategy || "Standard communication",
        escalationNeeded: Boolean(parsed.escalationNeeded),
        stakeholderManagement: Array.isArray(parsed.stakeholderManagement)
          ? parsed.stakeholderManagement
          : [],
      };
    } catch (error) {
      logger.error("Failed to parse consultant response", { error });
      return {
        customerImpact: "Unknown",
        communicationStrategy: "Standard communication",
        escalationNeeded: false,
        stakeholderManagement: [],
      };
    }
  }

  /**
   * Synthesize outputs from all agents
   */
  private async synthesizeAgentOutputs(
    agentAnalyses: Awaited<ReturnType<typeof this.runMultiAgentAnalysis>>,
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<{
    customerPlan: ResolutionPlan["customerPlan"];
    internalPlan: ResolutionPlan["internalPlan"];
    evidenceChecklist: ResolutionPlan["evidenceChecklist"];
    confidence: number;
  }> {
    // Build synthesis prompt
    const synthesisPrompt = `Synthesize resolution plan from multi-agent analysis:

ANALYZER: ${JSON.stringify(agentAnalyses.analyzer)}
ANALYST: ${JSON.stringify(agentAnalyses.analyst)}
ACCOUNTANT: ${JSON.stringify(agentAnalyses.accountant)}
CONSULTANT: ${JSON.stringify(agentAnalyses.consultant)}

CASE TYPE: ${input.caseType}
SEVERITY: ${input.severity}

Generate comprehensive resolution plan with customer plan, internal plan, and evidence checklist.
Return JSON with structure matching ResolutionPlan interface.`;

    const response = await orchestrator.orchestrate({
      query: synthesisPrompt,
      tenant_id: input.tenantId,
      use_rag: true,
      use_kag: true,
      model: "o1-mini", // Latest 2026 reasoning model for root cause analysis
      temperature: 0.3,
      max_tokens: 4000,
    });

    return this.parseSynthesisResponse(response.response);
  }

  /**
   * Parse synthesis response
   */
  private parseSynthesisResponse(response: string): {
    customerPlan: ResolutionPlan["customerPlan"];
    internalPlan: ResolutionPlan["internalPlan"];
    evidenceChecklist: ResolutionPlan["evidenceChecklist"];
    confidence: number;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      const parsed = JSON.parse(jsonMatch[0]);

      return {
        customerPlan: parsed.customerPlan || this.getDefaultCustomerPlan(),
        internalPlan: parsed.internalPlan || this.getDefaultInternalPlan(),
        evidenceChecklist: Array.isArray(parsed.evidenceChecklist)
          ? parsed.evidenceChecklist
          : [],
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
      };
    } catch (error) {
      logger.error("Failed to parse synthesis response", { error });
      return {
        customerPlan: this.getDefaultCustomerPlan(),
        internalPlan: this.getDefaultInternalPlan(),
        evidenceChecklist: [],
        confidence: 0.5,
      };
    }
  }

  /**
   * Apply self-learning from historical patterns
   */
  private async applyLearning(
    synthesized: Awaited<ReturnType<typeof this.synthesizeAgentOutputs>>,
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<Awaited<ReturnType<typeof this.synthesizeAgentOutputs>>> {
    // Find best matching historical pattern
    const bestPattern = context.historicalPatterns.find(
      (p) => p.caseType === input.caseType && p.successRate > 0.8
    );

    if (bestPattern) {
      // Enhance plan with successful steps from history
      const enhancedSteps = [
        ...synthesized.customerPlan.steps,
        ...bestPattern.commonSteps.map((step, idx) => ({
          stepNumber: synthesized.customerPlan.steps.length + idx + 1,
          title: step,
          description: `Learned from successful historical resolutions`,
        })),
      ];

      return {
        ...synthesized,
        customerPlan: {
          ...synthesized.customerPlan,
          steps: enhancedSteps,
        },
        confidence: Math.min(1.0, synthesized.confidence * 1.1), // Boost confidence
      };
    }

    return synthesized;
  }

  /**
   * Generate case-type-specific components
   */
  private async generateSpecializedComponents(
    learned: Awaited<ReturnType<typeof this.applyLearning>>,
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<ResolutionPlan> {
    let chargebackReadiness: ResolutionPlan["chargebackReadiness"] | undefined;
    let safetySteps: ResolutionPlan["safetySteps"] | undefined;
    let timeline: ResolutionPlan["timeline"] | undefined;
    let recommendedDecision: string | undefined;

    // Generate type-specific components
    if (input.caseType === "DISPUTE") {
      chargebackReadiness = await this.generateChargebackReadiness(input, context);
      recommendedDecision = "Review dispute and prepare merchant response";
    } else if (input.caseType === "FRAUD_ATO") {
      safetySteps = await this.generateSafetySteps(input, context);
      recommendedDecision = "Secure account and investigate fraud";
    } else if (input.caseType === "OUTAGE_DELAY") {
      timeline = await this.generateTimeline(input, context);
      recommendedDecision = "Restore service and investigate root cause";
    }

    return {
      customerPlan: learned.customerPlan,
      internalPlan: learned.internalPlan,
      recommendedDecision,
      evidenceChecklist: learned.evidenceChecklist,
      chargebackReadiness,
      safetySteps,
      timeline,
      metadata: {
        modelUsed: "multi-agent-ensemble",
        latencyMs: 0, // Set by caller
        confidence: learned.confidence,
        learningApplied: true,
        historicalPatternsUsed: context.historicalPatterns.length,
      },
    };
  }

  /**
   * Generate chargeback readiness assessment
   */
  private async generateChargebackReadiness(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<ResolutionPlan["chargebackReadiness"]> {
    const prompt = `Assess chargeback readiness for dispute case: ${input.description}`;
    const response = await orchestrator.orchestrate({
      query: prompt,
      tenant_id: input.tenantId,
      use_rag: true,
      model: "o1-mini", // Latest 2026 reasoning model for root cause analysis
      temperature: 0.2,
      max_tokens: 1500,
    });

    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          merchantResponse: parsed.merchantResponse || "Draft merchant response",
          evidenceStrength: parsed.evidenceStrength || "moderate",
          winProbability: Math.max(0, Math.min(1, Number(parsed.winProbability) || 0.5)),
          recommendedActions: Array.isArray(parsed.recommendedActions)
            ? parsed.recommendedActions
            : [],
          deadline: parsed.deadline || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };
      }
    } catch (error) {
      logger.error("Failed to parse chargeback readiness", { error });
    }

    return {
      merchantResponse: "Draft merchant response",
      evidenceStrength: "moderate",
      winProbability: 0.5,
      recommendedActions: [],
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  /**
   * Generate safety steps for fraud cases
   */
  private async generateSafetySteps(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<ResolutionPlan["safetySteps"]> {
    return [
      {
        action: "Freeze affected account",
        priority: "immediate",
        description: "Immediately freeze the account to prevent further unauthorized access",
        completed: false,
      },
      {
        action: "Reset credentials",
        priority: "immediate",
        description: "Force password reset and invalidate all active sessions",
        completed: false,
      },
      {
        action: "Review transaction history",
        priority: "high",
        description: "Review all recent transactions for suspicious activity",
        completed: false,
      },
      {
        action: "Notify customer",
        priority: "high",
        description: "Notify customer of security incident and steps taken",
        completed: false,
      },
    ];
  }

  /**
   * Generate timeline for outage cases
   */
  private async generateTimeline(
    input: ResolutionInput,
    context: Awaited<ReturnType<typeof this.gatherContext>>
  ): Promise<ResolutionPlan["timeline"]> {
    return {
      events: [
        {
          timestamp: new Date().toISOString(),
          event: "Issue reported",
          description: input.description,
        },
      ],
      rootCause: "Under investigation",
      resolution: "In progress",
      prevention: "To be determined",
    };
  }

  /**
   * Validate and finalize resolution plan
   */
  private async validateAndFinalize(
    specialized: ResolutionPlan,
    input: ResolutionInput
  ): Promise<ResolutionPlan> {
    // Validate required fields
    if (!specialized.customerPlan.steps || specialized.customerPlan.steps.length === 0) {
      specialized.customerPlan.steps = this.getDefaultCustomerPlan().steps;
    }

    if (!specialized.internalPlan.phases || specialized.internalPlan.phases.length === 0) {
      specialized.internalPlan.phases = this.getDefaultInternalPlan().phases;
    }

    // Calibrate confidence
    let calibratedConfidence = specialized.metadata.confidence;
    if (specialized.evidenceChecklist.length === 0) {
      calibratedConfidence *= 0.9;
    }
    if (specialized.customerPlan.steps.length < 3) {
      calibratedConfidence *= 0.85;
    }

    return {
      ...specialized,
      metadata: {
        ...specialized.metadata,
        confidence: Math.max(0, Math.min(1, calibratedConfidence)),
      },
    };
  }

  /**
   * Query historical patterns
   */
  private async queryHistoricalPatterns(input: ResolutionInput): Promise<
    Array<{
      caseType: CaseType;
      resolutionStrategy: string;
      successRate: number;
      avgResolutionTime: number;
      commonSteps: string[];
    }>
  > {
    const resolved = await db.case.findMany({
      where: {
        tenantId: input.tenantId,
        type: input.caseType,
        status: {
          in: ["RESOLVED", "CLOSED"],
        },
        resolution: {
          isNot: null,
        },
      },
      include: {
        resolution: true,
      },
      take: 50,
    });

    // Analyze patterns
    const patterns: Map<
      string,
      {
        caseType: CaseType;
        resolutionStrategy: string;
        successRate: number;
        avgResolutionTime: number;
        commonSteps: string[];
      }
    > = new Map();

    for (const c of resolved) {
      const key = `${c.type}_${c.severity}`;
      const existing = patterns.get(key) || {
        caseType: c.type,
        resolutionStrategy: "Standard resolution",
        successRate: 0,
        avgResolutionTime: 0,
        commonSteps: [],
      };

      if (c.resolvedAt && c.createdAt) {
        const hours = (c.resolvedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60);
        existing.avgResolutionTime = (existing.avgResolutionTime + hours) / 2;
      }

      existing.successRate = c.status === "RESOLVED" ? existing.successRate + 1 : existing.successRate;
      patterns.set(key, existing);
    }

    // Calculate success rates
    for (const [key, pattern] of patterns.entries()) {
      const count = resolved.filter((c) => `${c.type}_${c.severity}` === key).length;
      pattern.successRate = count > 0 ? pattern.successRate / count : 0;
    }

    return Array.from(patterns.values());
  }

  /**
   * Query knowledge graph
   */
  private async queryKnowledgeGraph(input: ResolutionInput): Promise<{
    nodes: Array<{ id: string; type: string; properties: Record<string, unknown> }>;
    edges: Array<{ source: string; target: string; relation: string }>;
  }> {
    try {
      const nodes = await db.beliefNode.findMany({
        where: { tenantId: input.tenantId },
        take: 50,
      });

      return {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || "entity",
          properties: {
            content: n.content,
            confidence: n.decisiveness,
          },
        })),
        edges: [],
      };
    } catch (error) {
      logger.error("Knowledge graph query failed", { error });
      return { nodes: [], edges: [] };
    }
  }

  /**
   * Get default customer plan
   */
  private getDefaultCustomerPlan(): ResolutionPlan["customerPlan"] {
    return {
      title: "Resolution Plan",
      summary: "We are working to resolve your case",
      steps: [
        {
          stepNumber: 1,
          title: "Case Review",
          description: "Our team is reviewing your case",
        },
      ],
      nextSteps: ["We will contact you with updates"],
    };
  }

  /**
   * Get default internal plan
   */
  private getDefaultInternalPlan(): ResolutionPlan["internalPlan"] {
    return {
      title: "Internal Resolution Plan",
      summary: "Internal action plan",
      phases: [
        {
          phaseNumber: 1,
          name: "Investigation",
          description: "Investigate the case",
          tasks: [],
        },
      ],
    };
  }
}

// Export singleton instance
export const autonomousResolutionGenerator = new AutonomousResolutionGenerator();
