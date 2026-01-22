/**
 * Prompt Registry (AI Governance)
 * Versioned prompt management with approval workflows and quality tracking
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { AIAnswerEvaluationHarness } from "@/lib/evaluation/harness";

export interface PromptVersion {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  content: string;
  description?: string;
  tags: string[];
  category?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  parameters?: Record<string, unknown>;
  policyChecks?: Record<string, unknown>;
  approved: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  deprecated: boolean;
  deprecatedAt?: Date;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromptEvaluationResult {
  id: string;
  promptId: string;
  evaluationId?: string;
  score: number;
  metrics: Record<string, unknown>;
  evaluator?: string;
  notes?: string;
  createdAt: Date;
}

export class PromptRegistry {
  private evaluationHarness: AIAnswerEvaluationHarness;

  constructor() {
    this.evaluationHarness = new AIAnswerEvaluationHarness();
  }

  /**
   * Register a new prompt version
   */
  async register(
    tenantId: string,
    name: string,
    content: string,
    options?: {
      version?: string;
      description?: string;
      tags?: string[];
      category?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      parameters?: Record<string, unknown>;
    }
  ): Promise<string> {
    // Determine version (auto-increment if not provided)
    let version = options?.version;
    if (!version) {
      const latest = await db.prompt.findFirst({
        where: {
          tenantId,
          name,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (latest) {
        // Parse semantic version and increment patch
        const parts = latest.version.split(".");
        if (parts.length === 3) {
          const patch = parseInt(parts[2], 10) + 1;
          version = `${parts[0]}.${parts[1]}.${patch}`;
        } else {
          version = "1.0.0";
        }
      } else {
        version = "1.0.0";
      }
    }

    // Run policy checks
    const policyChecks = await this.runPolicyChecks(content, tenantId);

    // Create prompt
    const prompt = await db.prompt.create({
      data: {
        tenantId,
        name,
        version,
        content,
        description: options?.description,
        tags: options?.tags || [],
        category: options?.category,
        model: options?.model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        parameters: options?.parameters as any,
        policyChecks: policyChecks as any,
        approved: false,
      },
    });

    logger.info("Prompt registered", {
      tenantId,
      name,
      version,
      category: options?.category,
    });

    return prompt.id;
  }

  /**
   * Get a prompt by name and version (or latest)
   */
  async get(
    tenantId: string,
    name: string,
    version?: string
  ): Promise<PromptVersion | null> {
    const where: any = {
      tenantId,
      name,
      deprecated: false,
    };

    if (version) {
      where.version = version;
    }

    const prompt = await db.prompt.findFirst({
      where,
      orderBy: version ? undefined : { createdAt: "desc" },
    });

    if (!prompt) {
      return null;
    }

    // Update usage stats
    await db.prompt.update({
      where: { id: prompt.id },
      data: {
        usageCount: {
          increment: 1,
        },
        lastUsed: new Date(),
      },
    });

    return this.mapToPromptVersion(prompt);
  }

  /**
   * List prompts for a tenant
   */
  async list(
    tenantId: string,
    options?: {
      category?: string;
      approved?: boolean;
      deprecated?: boolean;
    }
  ): Promise<PromptVersion[]> {
    const where: any = {
      tenantId,
    };

    if (options?.category) {
      where.category = options.category;
    }
    if (options?.approved !== undefined) {
      where.approved = options.approved;
    }
    if (options?.deprecated !== undefined) {
      where.deprecated = options.deprecated;
    }

    const prompts = await db.prompt.findMany({
      where,
      orderBy: [
        { name: "asc" },
        { createdAt: "desc" },
      ],
    });

    return prompts.map((p) => this.mapToPromptVersion(p));
  }

  /**
   * Approve a prompt version
   */
  async approve(
    promptId: string,
    approvedBy: string
  ): Promise<void> {
    await db.prompt.update({
      where: { id: promptId },
      data: {
        approved: true,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    logger.info("Prompt approved", {
      promptId,
      approvedBy,
    });
  }

  /**
   * Deprecate a prompt version
   */
  async deprecate(promptId: string): Promise<void> {
    await db.prompt.update({
      where: { id: promptId },
      data: {
        deprecated: true,
        deprecatedAt: new Date(),
      },
    });

    logger.info("Prompt deprecated", {
      promptId,
    });
  }

  /**
   * Evaluate a prompt with test cases
   */
  async evaluate(
    promptId: string,
    testCases: Array<{
      query: string;
      expectedEvidence: string[];
      context?: any;
    }>
  ): Promise<PromptEvaluationResult[]> {
    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
    });

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`);
    }

    const results: PromptEvaluationResult[] = [];

    for (const testCase of testCases) {
      // Run evaluation harness
      const evaluation = await this.evaluationHarness.evaluate(
        prompt.content,
        testCase.query, // Using query as response for evaluation
        testCase.expectedEvidence,
        {
          model: prompt.model || undefined,
          context: testCase.context,
          tenantId: prompt.tenantId,
        }
      );

      // Store evaluation result
      const evaluationRecord = await db.promptEvaluation.create({
        data: {
          promptId,
          score: evaluation.overall_score,
          metrics: evaluation.details as any,
          evaluator: prompt.model || "default",
        },
      });

      results.push({
        id: evaluationRecord.id,
        promptId,
        score: evaluation.overall_score,
        metrics: evaluation.details,
        evaluator: prompt.model || undefined,
        createdAt: evaluationRecord.createdAt,
      });
    }

    return results;
  }

  /**
   * Run policy checks on prompt content
   */
  private async runPolicyChecks(
    content: string,
    tenantId: string
  ): Promise<Record<string, unknown>> {
    const checks: Record<string, unknown> = {
      length: content.length,
      hasCitations: content.includes("[") && content.includes("]"),
      hasInstructions: content.toLowerCase().includes("instruction") || content.toLowerCase().includes("task"),
      timestamp: new Date().toISOString(),
    };

    // Check for potentially harmful content
    const harmfulPatterns = [
      /bypass/i,
      /ignore/i,
      /forget/i,
      /pretend/i,
    ];
    checks.hasHarmfulPatterns = harmfulPatterns.some((pattern) => pattern.test(content));

    // Check citation requirements (if tenant has rules)
    const citationRules = await db.citationRule.findMany({
      where: {
        tenantId,
        enabled: true,
      },
    });

    if (citationRules.length > 0) {
      checks.citationRuleCompliance = this.checkCitationCompliance(content, citationRules);
    }

    return checks;
  }

  /**
   * Check citation compliance with rules
   */
  private checkCitationCompliance(
    content: string,
    rules: Array<{ minCitations: number; requiredTypes: string[] }>
  ): Record<string, unknown> {
    // Extract citations (simple pattern matching)
    const citationMatches = content.match(/\[.*?\]/g) || [];
    const citationCount = citationMatches.length;

    const compliance: Record<string, unknown> = {
      citationCount,
      compliant: true,
      violations: [] as string[],
    };

    for (const rule of rules) {
      if (citationCount < rule.minCitations) {
        (compliance.violations as string[]).push(
          `Minimum citations not met: ${citationCount} < ${rule.minCitations}`
        );
        compliance.compliant = false;
      }
    }

    return compliance;
  }

  /**
   * Map database model to PromptVersion
   */
  private mapToPromptVersion(prompt: any): PromptVersion {
    return {
      id: prompt.id,
      tenantId: prompt.tenantId,
      name: prompt.name,
      version: prompt.version,
      content: prompt.content,
      description: prompt.description || undefined,
      tags: prompt.tags || [],
      category: prompt.category || undefined,
      model: prompt.model || undefined,
      temperature: prompt.temperature || undefined,
      maxTokens: prompt.maxTokens || undefined,
      parameters: prompt.parameters || undefined,
      policyChecks: prompt.policyChecks || undefined,
      approved: prompt.approved,
      approvedBy: prompt.approvedBy || undefined,
      approvedAt: prompt.approvedAt || undefined,
      deprecated: prompt.deprecated,
      deprecatedAt: prompt.deprecatedAt || undefined,
      usageCount: prompt.usageCount,
      lastUsed: prompt.lastUsed || undefined,
      createdAt: prompt.createdAt,
      updatedAt: prompt.updatedAt,
    };
  }
}

export const promptRegistry = new PromptRegistry();
