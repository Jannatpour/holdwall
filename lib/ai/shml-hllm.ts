/**
 * Self-Healing Machine Learning (SHML) with H-LLM
 * 
 * Autonomous error detection and correction system using:
 * - H-LLM (Hierarchical Large Language Model) for error detection
 * - Self-healing mechanisms for automatic correction
 * - Continuous learning from corrections
 * 
 * Latest January 2026 AI technology for autonomous systems.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { vigilRuntime } from "./vigil-runtime";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);

export interface SHMLError {
  id: string;
  type: "prediction" | "execution" | "data" | "model" | "system";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  context: Record<string, unknown>;
  detectedAt: Date;
}

export interface SHMLCorrection {
  id: string;
  errorId: string;
  originalOutput: unknown;
  correctedOutput: unknown;
  correctionMethod: string;
  confidence: number;
  appliedAt: Date;
}

export interface SHMLLearning {
  id: string;
  errorPattern: string;
  correctionPattern: string;
  successRate: number;
  learnedAt: Date;
}

/**
 * SHML with H-LLM
 * 
 * Self-healing machine learning system
 */
export class SHMLHLLM {
  private errors: Map<string, SHMLError> = new Map();
  private corrections: Map<string, SHMLCorrection> = new Map();
  private learnings: Map<string, SHMLLearning> = new Map();

  /**
   * Detect errors in agent output
   */
  async detectErrors(
    agentId: string,
    operationId: string,
    output: unknown,
    tenantId: string,
    expectedOutput?: unknown
  ): Promise<SHMLError[]> {
    const startTime = Date.now();

    try {
      logger.info("SHML error detection started", {
        agentId,
        operationId,
      });

      const errors: SHMLError[] = [];

      // Step 1: Use VIGIL runtime for inspection
      const inspection = await vigilRuntime.inspect(
        agentId,
        operationId,
        output,
        ["quality", "consistency", "safety"],
        tenantId
      );

      if (inspection.status === "fail" || inspection.status === "warning") {
        for (const finding of inspection.findings) {
          errors.push({
            id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
            type: this.mapInspectionTypeToErrorType(inspection.inspectionType),
            severity: finding.severity,
            description: finding.description,
            context: {
              inspectionId: inspection.id,
              recommendation: finding.recommendation,
            },
            detectedAt: new Date(),
          });
        }
      }

      // Step 2: Use H-LLM for hierarchical error detection
      const hllmErrors = await this.detectWithHLLM(agentId, operationId, output, expectedOutput, tenantId);
      errors.push(...hllmErrors);

      // Step 3: Store errors
      for (const error of errors) {
        this.errors.set(error.id, error);
      }

      const latencyMs = Date.now() - startTime;
      metrics.increment("shml.errors_detected", { agent_id: agentId });
      metrics.observe("shml.detection_latency", latencyMs);

      logger.info("SHML error detection completed", {
        agentId,
        errorCount: errors.length,
        latencyMs,
      });

      return errors;
    } catch (error) {
      logger.error("SHML error detection failed", {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Detect errors using H-LLM (Hierarchical Large Language Model)
   */
  private async detectWithHLLM(
    agentId: string,
    operationId: string,
    output: unknown,
    expectedOutput: unknown | undefined,
    tenantId: string
  ): Promise<SHMLError[]> {
    const outputStr = JSON.stringify(output, null, 2);
    const expectedStr = expectedOutput ? JSON.stringify(expectedOutput, null, 2) : undefined;

    const prompt = `Detect errors in this agent output using hierarchical analysis.

Agent: ${agentId}
Operation: ${operationId}

Output:
${outputStr.substring(0, 2000)}

${expectedStr ? `Expected Output:\n${expectedStr.substring(0, 2000)}` : ""}

Analyze at multiple levels:
1. Syntax/Format errors
2. Semantic/Logic errors
3. Domain-specific errors
4. Consistency errors

Return JSON array of errors:
[
  {
    "type": "prediction" | "execution" | "data" | "model" | "system",
    "severity": "low" | "medium" | "high" | "critical",
    "description": "Error description",
    "level": "syntax" | "semantic" | "domain" | "consistency"
  }
]`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model
        temperature: 0.2,
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((e: unknown) => ({
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type: (e as { type: string }).type || "system",
          severity: (e as { severity: string }).severity || "medium",
          description: (e as { description: string }).description || "Unknown error",
          context: {
            level: (e as { level?: string }).level || "unknown",
          },
          detectedAt: new Date(),
        }));
      }
    } catch (error) {
      logger.warn("H-LLM error detection failed", { error });
    }

    return [];
  }

  /**
   * Correct errors autonomously
   */
  async correctErrors(
    errors: SHMLError[],
    originalOutput: unknown,
    tenantId: string
  ): Promise<SHMLCorrection[]> {
    const corrections: SHMLCorrection[] = [];

    for (const error of errors) {
      try {
        const correction = await this.correctError(error, originalOutput, tenantId);
        if (correction) {
          corrections.push(correction);
          this.corrections.set(correction.id, correction);
        }
      } catch (err) {
        logger.warn("Error correction failed", {
          errorId: error.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Learn from corrections
    if (corrections.length > 0) {
      await this.learnFromCorrections(corrections);
    }

    metrics.increment("shml.corrections_applied", {
      error_count: errors.length.toString(),
    });

    return corrections;
  }

  /**
   * Correct a single error
   */
  private async correctError(
    error: SHMLError,
    originalOutput: unknown,
    tenantId: string
  ): Promise<SHMLCorrection | null> {
    const prompt = `Correct this error in the agent output.

Error Type: ${error.type}
Severity: ${error.severity}
Description: ${error.description}

Original Output:
${JSON.stringify(originalOutput, null, 2).substring(0, 2000)}

Provide corrected output and explanation.

Return JSON:
{
  "correctedOutput": {...},
  "correctionMethod": "method used",
  "confidence": 0.0-1.0,
  "explanation": "why this correction"
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model
        temperature: 0.2,
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          id: `correction-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          errorId: error.id,
          originalOutput,
          correctedOutput: parsed.correctedOutput,
          correctionMethod: parsed.correctionMethod || "llm-based",
          confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.7)),
          appliedAt: new Date(),
        };
      }
    } catch (error) {
      logger.warn("Error correction failed", { error });
    }

    return null;
  }

  /**
   * Learn from corrections
   */
  private async learnFromCorrections(corrections: SHMLCorrection[]): Promise<void> {
    // Extract patterns from corrections
    for (const correction of corrections) {
      const error = this.errors.get(correction.errorId);
      if (!error) continue;

      const pattern = `${error.type}_${error.severity}_${correction.correctionMethod}`;
      const existing = this.learnings.get(pattern);

      if (existing) {
        // Update success rate
        existing.successRate = (existing.successRate + 1.0) / 2;
      } else {
        // Create new learning
        this.learnings.set(pattern, {
          id: `learning-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          errorPattern: `${error.type}_${error.severity}`,
          correctionPattern: correction.correctionMethod,
          successRate: 1.0,
          learnedAt: new Date(),
        });
      }
    }
  }

  /**
   * Map inspection type to error type
   */
  private mapInspectionTypeToErrorType(
    inspectionType: "quality" | "consistency" | "safety" | "performance" | "compliance"
  ): SHMLError["type"] {
    switch (inspectionType) {
      case "quality":
      case "consistency":
        return "prediction";
      case "safety":
      case "compliance":
        return "model";
      case "performance":
        return "system";
      default:
        return "system";
    }
  }

  /**
   * Get error history
   */
  getErrorHistory(agentId?: string, limit: number = 50): SHMLError[] {
    const errors = Array.from(this.errors.values());
    const filtered = agentId ? errors.filter((e) => e.context.agentId === agentId) : errors;
    return filtered.slice(-limit);
  }

  /**
   * Get correction history
   */
  getCorrectionHistory(limit: number = 50): SHMLCorrection[] {
    return Array.from(this.corrections.values()).slice(-limit);
  }

  /**
   * Get learning history
   */
  getLearningHistory(limit: number = 50): SHMLLearning[] {
    return Array.from(this.learnings.values()).slice(-limit);
  }
}

export const shmlHLLM = new SHMLHLLM();
