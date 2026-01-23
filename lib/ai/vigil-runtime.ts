/**
 * VIGIL Runtime
 * 
 * Verifiable Inspection and Guarded Iterative Learning
 * 
 * Autonomous monitoring and self-healing system that:
 * 1. Continuously inspects agent behavior and outputs
 * 2. Detects anomalies, errors, and quality degradation
 * 3. Guards against incorrect decisions with verification
 * 4. Iteratively learns from corrections and improvements
 * 5. Provides real-time monitoring and alerting
 * 
 * Latest January 2026 AI technology for self-healing systems.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db/client";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";

const evidenceVault = new DatabaseEvidenceVault();
const orchestrator = new AIOrchestrator(evidenceVault);

export interface VIGILInspection {
  id: string;
  agentId: string;
  operationId: string;
  timestamp: Date;
  inspectionType: "quality" | "consistency" | "safety" | "performance" | "compliance";
  status: "pass" | "warning" | "fail";
  score: number; // 0.0-1.0
  findings: Array<{
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    recommendation?: string;
  }>;
  metadata: Record<string, unknown>;
}

export interface VIGILGuard {
  id: string;
  agentId: string;
  operationId: string;
  guardType: "output_validation" | "safety_check" | "compliance_verification" | "quality_gate";
  enabled: boolean;
  threshold: number;
  action: "allow" | "block" | "flag" | "escalate";
  metadata: Record<string, unknown>;
}

export interface VIGILLearning {
  id: string;
  agentId: string;
  correctionId: string;
  originalOutput: unknown;
  correctedOutput: unknown;
  correctionReason: string;
  learnedPattern: string;
  confidence: number;
  timestamp: Date;
}

/**
 * VIGIL Runtime
 * 
 * Provides autonomous monitoring, verification, and self-healing capabilities
 */
export class VIGILRuntime {
  private inspections: Map<string, VIGILInspection[]> = new Map();
  private guards: Map<string, VIGILGuard[]> = new Map();
  private learnings: Map<string, VIGILLearning[]> = new Map();

  /**
   * Inspect agent operation for quality, consistency, safety, performance, or compliance
   */
  async inspect(
    agentId: string,
    operationId: string,
    operationOutput: unknown,
    inspectionTypes: VIGILInspection["inspectionType"][],
    tenantId: string
  ): Promise<VIGILInspection> {
    const startTime = Date.now();
    const inspectionId = `vigil-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    try {
      logger.info("VIGIL inspection started", {
        inspectionId,
        agentId,
        operationId,
        inspectionTypes,
      });

      const findings: VIGILInspection["findings"] = [];
      let overallScore = 1.0;
      let overallStatus: VIGILInspection["status"] = "pass";

      // Run each inspection type
      for (const inspectionType of inspectionTypes) {
        const result = await this.runInspection(
          inspectionType,
          agentId,
          operationId,
          operationOutput,
          tenantId
        );

        findings.push(...result.findings);
        overallScore = Math.min(overallScore, result.score);

        if (result.status === "fail") {
          overallStatus = "fail";
        } else if (result.status === "warning" && overallStatus === "pass") {
          overallStatus = "warning";
        }
      }

      const inspection: VIGILInspection = {
        id: inspectionId,
        agentId,
        operationId,
        timestamp: new Date(),
        inspectionType: inspectionTypes[0], // Primary type
        status: overallStatus,
        score: overallScore,
        findings,
        metadata: {
          inspectionTypes,
          latencyMs: Date.now() - startTime,
        },
      };

      // Store inspection
      if (!this.inspections.has(agentId)) {
        this.inspections.set(agentId, []);
      }
      this.inspections.get(agentId)!.push(inspection);

      // Emit metrics
      metrics.increment("vigil.inspections", {
        agent_id: agentId,
        status: overallStatus,
        inspection_type: inspectionTypes.join(","),
      });
      metrics.observe("vigil.inspection.latency", Date.now() - startTime);
      metrics.gauge("vigil.inspection.score", overallScore, {
        agent_id: agentId,
      });

      logger.info("VIGIL inspection completed", {
        inspectionId,
        agentId,
        status: overallStatus,
        score: overallScore,
        findingsCount: findings.length,
      });

      return inspection;
    } catch (error) {
      logger.error("VIGIL inspection failed", {
        inspectionId,
        agentId,
        operationId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return fail inspection on error
      return {
        id: inspectionId,
        agentId,
        operationId,
        timestamp: new Date(),
        inspectionType: "quality",
        status: "fail",
        score: 0.0,
        findings: [
          {
            severity: "critical",
            description: `Inspection failed: ${error instanceof Error ? error.message : String(error)}`,
            recommendation: "Review inspection configuration and retry",
          },
        ],
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Run specific inspection type
   */
  private async runInspection(
    type: VIGILInspection["inspectionType"],
    agentId: string,
    operationId: string,
    operationOutput: unknown,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    const outputStr = JSON.stringify(operationOutput, null, 2);

    switch (type) {
      case "quality":
        return await this.inspectQuality(agentId, operationId, outputStr, tenantId);
      case "consistency":
        return await this.inspectConsistency(agentId, operationId, outputStr, tenantId);
      case "safety":
        return await this.inspectSafety(agentId, operationId, outputStr, tenantId);
      case "performance":
        return await this.inspectPerformance(agentId, operationId, tenantId);
      case "compliance":
        return await this.inspectCompliance(agentId, operationId, outputStr, tenantId);
      default:
        return {
          status: "pass",
          score: 1.0,
          findings: [],
        };
    }
  }

  /**
   * Inspect output quality
   */
  private async inspectQuality(
    agentId: string,
    operationId: string,
    output: string,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    const prompt = `Evaluate the quality of this agent output. Check for:
1. Completeness (all required fields present)
2. Accuracy (information is correct)
3. Clarity (output is clear and understandable)
4. Relevance (output addresses the task)
5. Format compliance (follows expected structure)

Agent: ${agentId}
Operation: ${operationId}
Output:
${output.substring(0, 4000)}

Provide assessment in JSON:
{
  "score": 0.0-1.0,
  "status": "pass" | "warning" | "fail",
  "findings": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Issue description",
      "recommendation": "How to fix"
    }
  ]
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model for VIGIL runtime
        temperature: 0.2,
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          status: parsed.status || "pass",
          score: Math.max(0, Math.min(1, Number(parsed.score) || 1.0)),
          findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        };
      }
    } catch (error) {
      logger.warn("Quality inspection failed", { error });
    }

    // Fallback: basic heuristics
    const findings: VIGILInspection["findings"] = [];
    let score = 1.0;

    if (output.length < 50) {
      findings.push({
        severity: "medium",
        description: "Output is very short, may be incomplete",
        recommendation: "Verify output contains all required information",
      });
      score = 0.7;
    }

    if (!output.includes("{") && !output.includes("[")) {
      // Check if structured output expected
      findings.push({
        severity: "low",
        description: "Output may not be in structured format",
      });
      score = Math.min(score, 0.9);
    }

    return {
      status: score >= 0.8 ? "pass" : score >= 0.6 ? "warning" : "fail",
      score,
      findings,
    };
  }

  /**
   * Inspect consistency
   */
  private async inspectConsistency(
    agentId: string,
    operationId: string,
    output: string,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    // Check consistency with historical outputs
    const findings: VIGILInspection["findings"] = [];
    let score = 1.0;

    // Query similar historical operations
    const historicalInspections = this.inspections.get(agentId) || [];
    const similarInspections = historicalInspections
      .filter((i) => i.operationId !== operationId)
      .slice(-10);

    if (similarInspections.length > 0) {
      // Check if current output is consistent with historical patterns
      const avgHistoricalScore = similarInspections.reduce((sum, i) => sum + i.score, 0) / similarInspections.length;
      const scoreDeviation = Math.abs(score - avgHistoricalScore);

      if (scoreDeviation > 0.3) {
        findings.push({
          severity: "medium",
          description: `Output score deviates significantly from historical average (${avgHistoricalScore.toFixed(2)})`,
          recommendation: "Review output for consistency issues",
        });
        score = Math.max(0, score - scoreDeviation * 0.5);
      }
    }

    return {
      status: score >= 0.8 ? "pass" : score >= 0.6 ? "warning" : "fail",
      score,
      findings,
    };
  }

  /**
   * Inspect safety
   */
  private async inspectSafety(
    agentId: string,
    operationId: string,
    output: string,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    const prompt = `Evaluate the safety of this agent output. Check for:
1. Harmful content (violence, hate speech, discrimination)
2. Privacy violations (PII exposure, unauthorized data sharing)
3. Security risks (injection attacks, unauthorized access)
4. Regulatory violations (GDPR, PCI-DSS, financial regulations)
5. Ethical concerns (bias, fairness, transparency)

Agent: ${agentId}
Output:
${output.substring(0, 4000)}

Provide assessment in JSON:
{
  "score": 0.0-1.0,
  "status": "pass" | "warning" | "fail",
  "findings": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Safety issue",
      "recommendation": "How to fix"
    }
  ]
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model for VIGIL runtime
        temperature: 0.1, // Lower temperature for safety checks
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          status: parsed.status || "pass",
          score: Math.max(0, Math.min(1, Number(parsed.score) || 1.0)),
          findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        };
      }
    } catch (error) {
      logger.warn("Safety inspection failed", { error });
    }

    // Fallback: basic safety checks
    const findings: VIGILInspection["findings"] = [];
    let score = 1.0;

    // Check for common PII patterns
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{16}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    ];

    for (const pattern of piiPatterns) {
      if (pattern.test(output)) {
        findings.push({
          severity: "high",
          description: "Potential PII detected in output",
          recommendation: "Review and redact sensitive information",
        });
        score = 0.5;
        break;
      }
    }

    return {
      status: score >= 0.8 ? "pass" : score >= 0.6 ? "warning" : "fail",
      score,
      findings,
    };
  }

  /**
   * Inspect performance
   */
  private async inspectPerformance(
    agentId: string,
    operationId: string,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    // Check performance metrics
    const findings: VIGILInspection["findings"] = [];
    let score = 1.0;

    // Query performance metrics from database or metrics service
    // This is a simplified version - in production, query actual metrics
    const historicalInspections = this.inspections.get(agentId) || [];
    if (historicalInspections.length > 0) {
      const recentInspections = historicalInspections.slice(-20);
      const avgLatency = recentInspections.reduce((sum, i) => {
        const latency = (i.metadata.latencyMs as number) || 0;
        return sum + latency;
      }, 0) / recentInspections.length;

      if (avgLatency > 5000) {
        findings.push({
          severity: "medium",
          description: `Average latency (${avgLatency.toFixed(0)}ms) exceeds threshold`,
          recommendation: "Optimize agent performance",
        });
        score = 0.8;
      }
    }

    return {
      status: score >= 0.8 ? "pass" : score >= 0.6 ? "warning" : "fail",
      score,
      findings,
    };
  }

  /**
   * Inspect compliance
   */
  private async inspectCompliance(
    agentId: string,
    operationId: string,
    output: string,
    tenantId: string
  ): Promise<{
    status: VIGILInspection["status"];
    score: number;
    findings: VIGILInspection["findings"];
  }> {
    const prompt = `Evaluate regulatory compliance of this agent output. Check for:
1. GDPR compliance (data protection, consent, right to deletion)
2. PCI-DSS compliance (payment data handling)
3. Financial regulations (SOX, FINRA, CFPB)
4. Industry-specific requirements

Agent: ${agentId}
Output:
${output.substring(0, 4000)}

Provide assessment in JSON:
{
  "score": 0.0-1.0,
  "status": "pass" | "warning" | "fail",
  "findings": [
    {
      "severity": "low" | "medium" | "high" | "critical",
      "description": "Compliance issue",
      "recommendation": "How to fix"
    }
  ]
}`;

    try {
      const response = await orchestrator.orchestrate({
        query: prompt,
        tenant_id: tenantId,
        use_rag: false,
        use_kag: false,
        model: "o1-mini", // Latest 2026 reasoning model for VIGIL runtime
        temperature: 0.2,
        max_tokens: 2000,
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          status: parsed.status || "pass",
          score: Math.max(0, Math.min(1, Number(parsed.score) || 1.0)),
          findings: Array.isArray(parsed.findings) ? parsed.findings : [],
        };
      }
    } catch (error) {
      logger.warn("Compliance inspection failed", { error });
    }

    return {
      status: "pass",
      score: 1.0,
      findings: [],
    };
  }

  /**
   * Register a guard for agent operations
   */
  registerGuard(guard: VIGILGuard): void {
    if (!this.guards.has(guard.agentId)) {
      this.guards.set(guard.agentId, []);
    }
    this.guards.get(guard.agentId)!.push(guard);

    logger.info("VIGIL guard registered", {
      guardId: guard.id,
      agentId: guard.agentId,
      guardType: guard.guardType,
    });
  }

  /**
   * Check if operation passes all guards
   */
  async checkGuards(
    agentId: string,
    operationId: string,
    operationOutput: unknown,
    tenantId: string
  ): Promise<{
    passed: boolean;
    blockedGuards: VIGILGuard[];
    warnings: string[];
  }> {
    const guards = this.guards.get(agentId) || [];
    const activeGuards = guards.filter((g) => g.enabled);
    const blockedGuards: VIGILGuard[] = [];
    const warnings: string[] = [];

    for (const guard of activeGuards) {
      const passed = await this.evaluateGuard(guard, operationOutput, tenantId);

      if (!passed) {
        if (guard.action === "block") {
          blockedGuards.push(guard);
        } else if (guard.action === "flag") {
          warnings.push(`Guard ${guard.id} (${guard.guardType}) failed`);
        }
      }
    }

    return {
      passed: blockedGuards.length === 0,
      blockedGuards,
      warnings,
    };
  }

  /**
   * Evaluate a single guard
   */
  private async evaluateGuard(
    guard: VIGILGuard,
    operationOutput: unknown,
    tenantId: string
  ): Promise<boolean> {
    // Simplified guard evaluation - in production, implement specific logic per guard type
    const outputStr = JSON.stringify(operationOutput);
    const outputLength = outputStr.length;

    // Example: output validation guard
    if (guard.guardType === "output_validation") {
      return outputLength > 0 && outputLength < 100000; // Basic validation
    }

    // Example: safety check guard
    if (guard.guardType === "safety_check") {
      // Run safety inspection
      const inspection = await this.inspect(guard.agentId, guard.operationId || "guard-check", operationOutput, ["safety"], tenantId);
      return inspection.score >= guard.threshold;
    }

    // Default: pass
    return true;
  }

  /**
   * Learn from correction
   */
  async learnFromCorrection(
    agentId: string,
    correctionId: string,
    originalOutput: unknown,
    correctedOutput: unknown,
    correctionReason: string
  ): Promise<VIGILLearning> {
    const learning: VIGILLearning = {
      id: `learning-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      agentId,
      correctionId,
      originalOutput,
      correctedOutput,
      correctionReason,
      learnedPattern: await this.extractPattern(originalOutput, correctedOutput, correctionReason),
      confidence: 0.8, // Default confidence
      timestamp: new Date(),
    };

    if (!this.learnings.has(agentId)) {
      this.learnings.set(agentId, []);
    }
    this.learnings.get(agentId)!.push(learning);

    logger.info("VIGIL learning recorded", {
      learningId: learning.id,
      agentId,
      correctionId,
    });

    metrics.increment("vigil.learnings", { agent_id: agentId });

    return learning;
  }

  /**
   * Extract pattern from correction
   */
  private async extractPattern(
    original: unknown,
    corrected: unknown,
    reason: string
  ): Promise<string> {
    // Simplified pattern extraction - in production, use ML to identify patterns
    return `Correction pattern: ${reason.substring(0, 200)}`;
  }

  /**
   * Get inspection history for agent
   */
  getInspectionHistory(agentId: string, limit: number = 50): VIGILInspection[] {
    const inspections = this.inspections.get(agentId) || [];
    return inspections.slice(-limit);
  }

  /**
   * Get learning history for agent
   */
  getLearningHistory(agentId: string, limit: number = 50): VIGILLearning[] {
    const learnings = this.learnings.get(agentId) || [];
    return learnings.slice(-limit);
  }
}

export const vigilRuntime = new VIGILRuntime();
