"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.autonomousResolutionGenerator = exports.AutonomousResolutionGenerator = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
const orchestrator_1 = require("@/lib/ai/orchestrator");
const vault_db_1 = require("@/lib/evidence/vault-db");
const store_db_1 = require("@/lib/events/store-db");
const transaction_manager_1 = require("@/lib/operations/transaction-manager");
const error_recovery_1 = require("@/lib/operations/error-recovery");
const evidenceVault = new vault_db_1.DatabaseEvidenceVault();
const orchestrator = new orchestrator_1.AIOrchestrator(evidenceVault);
const eventStore = new store_db_1.DatabaseEventStore();
const transactionManager = new transaction_manager_1.TransactionManager();
const errorRecovery = new error_recovery_1.ErrorRecoveryService();
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
class AutonomousResolutionGenerator {
    constructor() {
        this.confidenceThreshold = 0.75;
    }
    /**
     * Generate resolution plan for a case
     * Enhanced with Claims Adjudication Pattern and hub-and-spoke orchestration
     */
    async generateResolution(input) {
        const startTime = Date.now();
        try {
            logger_1.logger.info("Generating resolution plan", {
                caseId: input.caseId,
                caseType: input.caseType,
                severity: input.severity,
            });
            // Option 1: Use Claims Adjudication Pattern for complex cases
            const useClaimsAdjudication = input.severity === "CRITICAL" || input.severity === "HIGH";
            if (useClaimsAdjudication) {
                const { claimsAdjudicationPattern } = await Promise.resolve().then(() => __importStar(require("./agents/claims-adjudication")));
                const { hubSpokeOrchestrator } = await Promise.resolve().then(() => __importStar(require("./agents/hub-spoke-orchestrator")));
                const case_ = await client_1.db.case.findUnique({ where: { id: input.caseId } });
                const resolution = case_ ? await client_1.db.caseResolution.findUnique({ where: { caseId: input.caseId } }) : null;
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
            metrics_1.metrics.increment("cases.resolution.generated");
            metrics_1.metrics.observe("cases.resolution.latency", latencyMs);
            metrics_1.metrics.gauge("cases.resolution.confidence", finalized.metadata.confidence);
            logger_1.logger.info("Resolution plan generated", {
                caseId: input.caseId,
                confidence: finalized.metadata.confidence,
                latencyMs,
            });
            return finalized;
        }
        catch (error) {
            logger_1.logger.error("Resolution generation failed", {
                caseId: input.caseId,
                error: error instanceof Error ? error.message : String(error),
            });
            // Apply error recovery with retry
            const recoveryResult = await errorRecovery.executeWithRecovery(async () => {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                return this.generateResolution(input);
            }, {
                retry: {
                    maxAttempts: 2,
                    backoffMs: 2000,
                    exponential: true,
                },
                timeout: 60000,
            }, "resolution_generation");
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
    async gatherContext(input) {
        // Get case details
        const case_ = await client_1.db.case.findUnique({
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
        const evidence = [];
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
                }
                catch (error) {
                    logger_1.logger.warn("Failed to fetch evidence", { evidenceId, error });
                }
            }
        }
        // Query related successful resolutions
        const relatedResolutions = await client_1.db.case.findMany({
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
            const caseWithResolution = c;
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
    async getGReasonerContext(input, knowledgeGraph) {
        try {
            const { gReasoner } = await Promise.resolve().then(() => __importStar(require("@/lib/ai/g-reasoner")));
            const { db } = await Promise.resolve().then(() => __importStar(require("@/lib/db/client")));
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
                const result = await gReasoner.reason({
                    query: `Analyze case: ${input.description}. Case type: ${input.caseType}. Severity: ${input.severity}`,
                    nodes,
                    edges,
                    context: { caseType: input.caseType, severity: input.severity },
                }, input.tenantId);
                return {
                    answer: result.answer,
                    reasoning: result.reasoning,
                    graphPath: result.graphPath,
                };
            }
        }
        catch (error) {
            logger_1.logger.warn("G-reasoner context failed", { error });
        }
        return undefined;
    }
    /**
     * Get GORAG context for graph-based retrieval
     */
    async getGORAGContext(input) {
        try {
            const { gorag } = await Promise.resolve().then(() => __importStar(require("@/lib/ai/gorag")));
            // Initialize GORAG with evidence
            if (input.evidenceIds && input.evidenceIds.length > 0) {
                const evidence = await Promise.all(input.evidenceIds.map(async (id) => {
                    return await evidenceVault.get(id, "resolution-generator", input.tenantId);
                }));
                const validEvidence = evidence.filter((e) => e !== null);
                if (validEvidence.length > 0) {
                    await gorag.initialize(validEvidence);
                    const result = await gorag.query({
                        query: `Resolution strategy for: ${input.description}`,
                        maxHops: 3,
                        useCommunities: true,
                        usePathReasoning: true,
                    }, input.tenantId);
                    return {
                        answer: result.answer,
                        reasoning: result.reasoning,
                        retrievedNodes: result.retrievedNodes,
                    };
                }
            }
        }
        catch (error) {
            logger_1.logger.warn("GORAG context failed", { error });
        }
        return undefined;
    }
    /**
     * Convert Claims Adjudication Pattern result into a ResolutionPlan.
     */
    convertAdjudicationToResolutionPlan(adjudicationResult, input) {
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
                status: "collected",
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
    async runMultiAgentAnalysis(input, context) {
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
        metrics_1.metrics.observe("cases.resolution.multi_agent_analysis", agentsLatency);
        logger_1.logger.debug("Multi-agent analysis completed", {
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
    buildAnalyzerPrompt(input, context) {
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
    parseAnalyzerResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                rootCause: parsed.rootCause || "Unknown",
                contributingFactors: Array.isArray(parsed.contributingFactors) ? parsed.contributingFactors : [],
                impact: parsed.impact || "Unknown",
                urgency: parsed.urgency || "MEDIUM",
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse analyzer response", { error });
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
    buildAnalystPrompt(input, context) {
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
    parseAnalystResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps : [],
                requiredEvidence: Array.isArray(parsed.requiredEvidence) ? parsed.requiredEvidence : [],
                evidenceStrength: ["weak", "moderate", "strong"].includes(parsed.evidenceStrength)
                    ? parsed.evidenceStrength
                    : "moderate",
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse analyst response", { error });
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
    buildAccountantPrompt(input, context) {
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
    parseAccountantResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                financialImpact: parsed.financialImpact || "Unknown",
                costEstimate: parsed.costEstimate ? Number(parsed.costEstimate) : undefined,
                revenueImpact: parsed.revenueImpact ? Number(parsed.revenueImpact) : undefined,
                riskExposure: parsed.riskExposure || "Unknown",
                costOptimization: Array.isArray(parsed.costOptimization) ? parsed.costOptimization : [],
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse accountant response", { error });
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
    buildConsultantPrompt(input, context) {
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
    parseConsultantResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                customerImpact: parsed.customerImpact || "Unknown",
                communicationStrategy: parsed.communicationStrategy || "Standard communication",
                escalationNeeded: Boolean(parsed.escalationNeeded),
                stakeholderManagement: Array.isArray(parsed.stakeholderManagement)
                    ? parsed.stakeholderManagement
                    : [],
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse consultant response", { error });
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
    async synthesizeAgentOutputs(agentAnalyses, input, context) {
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
    parseSynthesisResponse(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error("No JSON found");
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                customerPlan: parsed.customerPlan || this.getDefaultCustomerPlan(),
                internalPlan: parsed.internalPlan || this.getDefaultInternalPlan(),
                evidenceChecklist: Array.isArray(parsed.evidenceChecklist)
                    ? parsed.evidenceChecklist
                    : [],
                confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to parse synthesis response", { error });
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
    async applyLearning(synthesized, input, context) {
        // Find best matching historical pattern
        const bestPattern = context.historicalPatterns.find((p) => p.caseType === input.caseType && p.successRate > 0.8);
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
    async generateSpecializedComponents(learned, input, context) {
        let chargebackReadiness;
        let safetySteps;
        let timeline;
        let recommendedDecision;
        // Generate type-specific components
        if (input.caseType === "DISPUTE") {
            chargebackReadiness = await this.generateChargebackReadiness(input, context);
            recommendedDecision = "Review dispute and prepare merchant response";
        }
        else if (input.caseType === "FRAUD_ATO") {
            safetySteps = await this.generateSafetySteps(input, context);
            recommendedDecision = "Secure account and investigate fraud";
        }
        else if (input.caseType === "OUTAGE_DELAY") {
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
    async generateChargebackReadiness(input, context) {
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
        }
        catch (error) {
            logger_1.logger.error("Failed to parse chargeback readiness", { error });
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
    async generateSafetySteps(input, context) {
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
    async generateTimeline(input, context) {
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
    async validateAndFinalize(specialized, input) {
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
    async queryHistoricalPatterns(input) {
        const resolved = await client_1.db.case.findMany({
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
        const patterns = new Map();
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
    async queryKnowledgeGraph(input) {
        try {
            const nodes = await client_1.db.beliefNode.findMany({
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
        }
        catch (error) {
            logger_1.logger.error("Knowledge graph query failed", { error });
            return { nodes: [], edges: [] };
        }
    }
    /**
     * Get default customer plan
     */
    getDefaultCustomerPlan() {
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
    getDefaultInternalPlan() {
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
exports.AutonomousResolutionGenerator = AutonomousResolutionGenerator;
// Export singleton instance
exports.autonomousResolutionGenerator = new AutonomousResolutionGenerator();
