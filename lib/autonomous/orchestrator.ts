/**
 * Autonomous Operations Orchestrator
 * 
 * Unified orchestrator that coordinates all autonomous operations:
 * - Monitoring (web, social, forums, AI answers)
 * - Publishing (PADL, third-party, PR, social)
 * - Engagement (responses, crisis, approvals)
 * - Semantic dominance (AEO, knowledge graphs, citations)
 * 
 * Works entirely through public surfaces with zero integration required.
 */

import { PAIAggregator } from "../collection/pai-aggregator";
import { PADLDistributor } from "../publishing/padl-distributor";
import { CrisisResponder } from "../engagement/crisis-responder";
import { ResponseGenerator } from "../engagement/response-generator";
import { MultiPlatformDistributor } from "../engagement/multi-platform-distributor";
import { ApprovalGateway } from "../engagement/approval-gateway";
import { AEOOptimizer } from "../seo/aeo-optimizer";
import { KnowledgeGraphBuilder } from "../seo/knowledge-graph-builder";
import { logger } from "../logging/logger";
import { CitationOptimizer } from "../seo/citation-optimizer";
import { LLMCrawlerGuide } from "../seo/llm-crawler-guide";
import { TopicalAuthority } from "../seo/topical-authority";
import { AdvancedAIIntegration } from "../ai/integration";
import { POSOrchestrator } from "../pos/orchestrator";
import { NarrativeOrchestrator } from "./narrative-orchestrator";
import type { Evidence } from "../evidence/vault";
import type { ClaimCluster } from "../claims/extraction";

export interface AutonomousOperationConfig {
  tenantId: string;
  brandName: string;
  enabledOperations: {
    monitoring?: boolean;
    publishing?: boolean;
    engagement?: boolean;
    semanticDominance?: boolean;
  };
  policyConstraints?: {
    requireApproval?: boolean;
    autoApproveThreshold?: number;
    maxOperationsPerDay?: number;
  };
}

export interface AutonomousOperationResult {
  operationId: string;
  type: "monitor" | "publish" | "engage" | "optimize";
  status: "completed" | "pending_approval" | "failed";
  results: unknown;
  timestamp: string;
}

export class AutonomousOrchestrator {
  private paiAggregator: PAIAggregator;
  private padlDistributor: PADLDistributor;
  private crisisResponder: CrisisResponder;
  private responseGenerator: ResponseGenerator;
  private multiPlatformDistributor: MultiPlatformDistributor;
  private approvalGateway: ApprovalGateway;
  private aeoOptimizer: AEOOptimizer;
  private knowledgeGraphBuilder: KnowledgeGraphBuilder;
  private citationOptimizer: CitationOptimizer;
  private llmCrawlerGuide: LLMCrawlerGuide;
  private topicalAuthority: TopicalAuthority;
  private aiIntegration: AdvancedAIIntegration;
  private posOrchestrator: POSOrchestrator;
  private narrativeOrchestrator: NarrativeOrchestrator | null = null;
  private config: AutonomousOperationConfig;

  constructor(config: AutonomousOperationConfig) {
    this.config = config;
    this.paiAggregator = new PAIAggregator();
    this.padlDistributor = new PADLDistributor();
    this.crisisResponder = new CrisisResponder();
    this.responseGenerator = new ResponseGenerator();
    this.multiPlatformDistributor = new MultiPlatformDistributor();
    this.approvalGateway = new ApprovalGateway();
    this.aeoOptimizer = new AEOOptimizer();
    this.knowledgeGraphBuilder = new KnowledgeGraphBuilder();
    this.citationOptimizer = new CitationOptimizer();
    this.llmCrawlerGuide = new LLMCrawlerGuide();
    this.topicalAuthority = new TopicalAuthority();
    this.aiIntegration = new AdvancedAIIntegration({
      tenantId: config.tenantId,
      enableGraphNeuralNetworks: true,
      enableAdvancedRAG: true,
      enableSemanticSearch: true,
      enableMultimodalDetection: true,
      enableAIEvaluation: true,
    });
    this.posOrchestrator = new POSOrchestrator();
    
    // Initialize narrative orchestrator if enabled
    if (config.enabledOperations.monitoring || config.enabledOperations.publishing) {
      this.narrativeOrchestrator = new NarrativeOrchestrator({
        tenant_id: config.tenantId,
        brand_name: config.brandName,
        autonomy_level: {
          ingestion: config.enabledOperations.monitoring ?? true,
          analysis: true,
          drafting: config.enabledOperations.publishing ?? false,
          measurement: true,
          publishing: false, // Always human-gated
        },
        safety_checks: {
          citation_grounded: true,
          defamation: true,
          privacy: true,
          consistency: true,
          escalation: true,
        },
      });
    }
  }

  /**
   * Execute autonomous monitoring cycle
   */
  async executeMonitoringCycle(): Promise<AutonomousOperationResult> {
    if (!this.config.enabledOperations.monitoring) {
      return {
        operationId: crypto.randomUUID(),
        type: "monitor",
        status: "failed",
        results: { error: "Monitoring disabled" },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Aggregate PAI from all sources
      const paiData = await this.paiAggregator.aggregateDefaultSources(this.config.brandName);

      // Process through AI pipeline
      const processed = await this.processSignals(paiData);

      return {
        operationId: crypto.randomUUID(),
        type: "monitor",
        status: "completed",
        results: {
          signalsFound: paiData.length,
          processed: processed.length,
          threats: processed.filter(p => p.severity === "high" || p.severity === "critical").length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: crypto.randomUUID(),
        type: "monitor",
        status: "failed",
        results: { error: error instanceof Error ? error.message : "Unknown error" },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute autonomous publishing cycle
   */
  async executePublishingCycle(
    artifactId: string,
    content: string,
    title: string
  ): Promise<AutonomousOperationResult> {
    if (!this.config.enabledOperations.publishing) {
      return {
        operationId: crypto.randomUUID(),
        type: "publish",
        status: "failed",
        results: { error: "Publishing disabled" },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Optimize for semantic dominance first
      const aeoOptimized = await this.aeoOptimizer.optimize({
        content,
        title,
        targetEngines: ["chatgpt", "perplexity", "gemini"],
      });

      const citationOptimized = await this.citationOptimizer.optimize({
        content: aeoOptimized.optimized,
        title,
        includeSources: true,
        includeDates: true,
      });

      // Publish autonomously
      const publishResult = await this.padlDistributor.publishAutonomously({
        artifactId,
        content: citationOptimized.optimized,
        title,
        contentType: "article",
        urgency: "medium",
        autoSelectChannels: true,
        autoOptimizeTiming: true,
        autoAdaptContent: true,
        policyConstraints: this.config.policyConstraints,
      });

      return {
        operationId: crypto.randomUUID(),
        type: "publish",
        status: publishResult.distributionResults.some(r => r.success)
          ? "completed"
          : "failed",
        results: publishResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: crypto.randomUUID(),
        type: "publish",
        status: "failed",
        results: { error: error instanceof Error ? error.message : "Unknown error" },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute autonomous engagement cycle
   */
  async executeEngagementCycle(
    signal: { content: string; url: string; platform: string }
  ): Promise<AutonomousOperationResult> {
    if (!this.config.enabledOperations.engagement) {
      return {
        operationId: crypto.randomUUID(),
        type: "engage",
        status: "failed",
        results: { error: "Engagement disabled" },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // Generate response
      const response = await this.responseGenerator.generate({
        context: signal.content,
        intent: "inform",
        tone: "helpful",
        includeEvidence: true,
      });

      // Check if approval needed
      const requiresApproval = this.config.policyConstraints?.requireApproval ?? true;
      let status: "completed" | "pending_approval" | "failed" = "completed";

      if (requiresApproval) {
        const approval = await this.approvalGateway.requestApproval(
          {
            resourceType: "engagement",
            resourceId: signal.url,
            action: "publish",
            content: response.response,
            context: {
              platform: signal.platform,
              originalContent: signal.content,
            },
            priority: "medium",
          },
          this.config.tenantId
        );

        if (approval.status !== "approved") {
          status = "pending_approval";
        }
      }

      // Distribute if approved
      let distributionResults: unknown = null;
      if (status === "completed") {
        distributionResults = await this.multiPlatformDistributor.distribute({
          tenantId: this.config.tenantId,
          response: response.response,
          platforms: [signal.platform as any],
          originalPost: {
            url: signal.url,
            platform: signal.platform,
            content: signal.content,
          },
          requireApproval: false, // Already approved
        });
      }

      return {
        operationId: crypto.randomUUID(),
        type: "engage",
        status,
        results: {
          response: response.response,
          distributionResults,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: crypto.randomUUID(),
        type: "engage",
        status: "failed",
        results: { error: error instanceof Error ? error.message : "Unknown error" },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute semantic dominance optimization
   */
  async executeSemanticDominanceOptimization(
    content: string,
    title: string
  ): Promise<AutonomousOperationResult> {
    if (!this.config.enabledOperations.semanticDominance) {
      return {
        operationId: crypto.randomUUID(),
        type: "optimize",
        status: "failed",
        results: { error: "Semantic dominance disabled" },
        timestamp: new Date().toISOString(),
      };
    }

    try {
      // AEO optimization
      const aeoResult = await this.aeoOptimizer.optimize({
        content,
        title,
        targetEngines: ["chatgpt", "perplexity", "gemini", "claude"],
      });

      // Citation optimization
      const citationResult = await this.citationOptimizer.optimize({
        content: aeoResult.optimized,
        title,
        includeSources: true,
        includeDates: true,
      });

      // Build knowledge graph
      const knowledgeGraph = await this.knowledgeGraphBuilder.buildGraph({
        brandName: this.config.brandName,
        authoritativeSources: [],
        relatedEntities: [],
      });

      // Generate LLM crawler guide
      const crawlerGuide = this.llmCrawlerGuide.generateGuide({
        siteUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://holdwall.com",
        brandName: this.config.brandName,
        description: `Official information about ${this.config.brandName}`,
        keyPages: [],
      });

      return {
        operationId: crypto.randomUUID(),
        type: "optimize",
        status: "completed",
        results: {
          aeoOptimized: aeoResult,
          citationOptimized: citationResult,
          knowledgeGraph,
          crawlerGuide,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: crypto.randomUUID(),
        type: "optimize",
        status: "failed",
        results: { error: error instanceof Error ? error.message : "Unknown error" },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Process signals through AI pipeline
   */
  private async processSignals(
    paiData: Array<{ content: string; metadata: Record<string, unknown> }>
  ): Promise<Array<{ content: string; severity: "low" | "medium" | "high" | "critical" }>> {
    const processed = [];

    for (const data of paiData) {
      // Use AI to assess severity
      const severity = await this.assessSeverity(data.content);

      processed.push({
        content: data.content,
        severity,
      });
    }

    return processed;
  }

  /**
   * Assess signal severity using AI
   */
  private async assessSeverity(content: string): Promise<"low" | "medium" | "high" | "critical"> {
    // Use sentiment analysis and threat detection
    const sentiment = await this.aiIntegration.embedText(content);
    
    // Simple heuristic (in production, would use more sophisticated analysis)
    const negativeWords = ["scam", "fraud", "terrible", "awful", "problem", "issue", "complaint"];
    const criticalWords = ["lawsuit", "legal", "sue", "court", "regulatory", "investigation"];

    const lowerContent = content.toLowerCase();
    const hasCritical = criticalWords.some(word => lowerContent.includes(word));
    const hasNegative = negativeWords.some(word => lowerContent.includes(word));

    if (hasCritical) {
      return "critical";
    } else if (hasNegative) {
      return "high";
    } else {
      return "medium";
    }
  }

  /**
   * Execute POS cycle (Perception Operating System)
   */
  async executePOSCycle(): Promise<AutonomousOperationResult> {
    try {
      const posResult = await this.posOrchestrator.executePOSCycle(this.config.tenantId);
      
      return {
        operationId: crypto.randomUUID(),
        type: "optimize",
        status: posResult.success ? "completed" : "failed",
        results: {
          actions: posResult.actions,
          metrics: posResult.metrics,
          posScore: posResult.metrics.overall.posScore,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        operationId: crypto.randomUUID(),
        type: "optimize",
        status: "failed",
        results: { error: error instanceof Error ? error.message : "Unknown error" },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute full autonomous cycle (includes narrative orchestration)
   */
  async executeFullCycle(): Promise<AutonomousOperationResult[]> {
    const results: AutonomousOperationResult[] = [];

    // Execute narrative orchestration cycle if enabled
    if (this.narrativeOrchestrator) {
      try {
        const narrativeResult = await this.narrativeOrchestrator.executeCycle();
        results.push({
          operationId: narrativeResult.cycle_id,
          type: "monitor",
          status: narrativeResult.status === "completed" ? "completed" : narrativeResult.status === "pending_approval" ? "pending_approval" : "failed",
          results: narrativeResult,
          timestamp: narrativeResult.created_at,
        });
      } catch (error) {
        logger.error("Narrative orchestration cycle failed", {
          error: error instanceof Error ? error.message : String(error),
          tenant_id: this.config.tenantId,
        });
      }
    }

    // Execute legacy cycles (for backward compatibility)
    if (this.config.enabledOperations.monitoring && !this.narrativeOrchestrator) {
      const monitoringResult = await this.executeMonitoringCycle();
      results.push(monitoringResult);
    }

    if (this.config.enabledOperations.publishing && !this.narrativeOrchestrator) {
      // Legacy publishing cycle
    }

    return results;
  }

  /**
   * Execute legacy full cycle (backward compatibility)
   */
  async executeLegacyFullCycle(): Promise<AutonomousOperationResult[]> {
    const results: AutonomousOperationResult[] = [];

    // 1. Monitoring
    if (this.config.enabledOperations.monitoring) {
      const monitorResult = await this.executeMonitoringCycle();
      results.push(monitorResult);
    }

    // 2. POS cycle (Perception Operating System)
    try {
      const posResult = await this.executePOSCycle();
      results.push(posResult);
    } catch (error) {
      // Log but don't fail entire cycle
      logger.error("POS cycle failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // 3. Semantic dominance (continuous optimization)
    if (this.config.enabledOperations.semanticDominance) {
      // This would be triggered by content updates
      // For now, skip in full cycle
    }

    return results;
  }
}
