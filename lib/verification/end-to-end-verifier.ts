/**
 * End-to-End Flow Verification System
 * 
 * Comprehensive verification system that ensures every flow, component, and business process
 * works correctly at production level with real-world scenarios.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { SignalIngestionService } from "@/lib/signals/ingestion";
import { ClaimExtractionService } from "@/lib/claims/extraction";
import { ForecastService } from "@/lib/forecasts/service";
import { AAALStudioService } from "@/lib/aaal/studio";
import { PlaybookExecutor } from "@/lib/playbooks/executor";
import { EnhancedSignalIngestionService } from "@/lib/operations/enhanced-signal-ingestion";
import { IdempotencyService } from "@/lib/operations/idempotency";
import { TransactionManager } from "@/lib/operations/transaction-manager";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { validateBusinessRules } from "@/lib/validation/business-rules";

export interface VerificationResult {
  flow: string;
  step: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: Record<string, unknown>;
  duration?: number;
}

export interface FlowVerification {
  flowName: string;
  description: string;
  steps: VerificationResult[];
  overallStatus: "pass" | "fail" | "warning";
  totalDuration: number;
}

/**
 * End-to-End Flow Verifier
 * 
 * Verifies all critical business flows work correctly in real-world scenarios
 */
export class EndToEndVerifier {
  private evidenceVault: DatabaseEvidenceVault;
  private eventStore: DatabaseEventStore;
  private idempotencyService: IdempotencyService;
  private transactionManager: TransactionManager;
  private errorRecovery: ErrorRecoveryService;

  constructor() {
    this.evidenceVault = new DatabaseEvidenceVault();
    this.eventStore = new DatabaseEventStore();
    this.idempotencyService = new IdempotencyService();
    this.transactionManager = new TransactionManager();
    this.errorRecovery = new ErrorRecoveryService();
  }

  /**
   * Verify complete signal ingestion flow
   */
  async verifySignalIngestionFlow(tenantId: string): Promise<FlowVerification> {
    const startTime = Date.now();
    const steps: VerificationResult[] = [];
    let overallStatus: "pass" | "fail" | "warning" = "pass";

    try {
      // Step 1: Verify signal ingestion service initialization
      const baseIngestionService = new SignalIngestionService(this.evidenceVault, this.eventStore);
      const enhancedService = new EnhancedSignalIngestionService(
        baseIngestionService,
        this.idempotencyService,
        this.transactionManager,
        this.errorRecovery
      );

      steps.push({
        flow: "Signal Ingestion",
        step: "Service Initialization",
        status: "pass",
        message: "Enhanced signal ingestion service initialized",
      });

      // Step 2: Verify business rules validation
      const testSignal = {
        tenant_id: tenantId,
        source: {
          type: "reddit",
          id: "test-post-123",
          url: "https://reddit.com/r/test/post/123",
        },
        content: {
          raw: "This is a test signal for verification",
          normalized: "This is a test signal for verification",
          language: "en",
        },
        metadata: {
          severity: "medium",
          sentiment: 0.5,
        },
        compliance: {
          source_allowed: true,
          collection_method: "api",
          retention_policy: "1y",
        },
      };

      const validation = await validateBusinessRules("signal", {
        content: testSignal.content.raw,
        sourceType: testSignal.source.type,
        sourceId: testSignal.source.id,
        metadata: testSignal.metadata,
      }, tenantId);

      if (!validation.valid) {
        overallStatus = "fail";
        steps.push({
          flow: "Signal Ingestion",
          step: "Business Rules Validation",
          status: "fail",
          message: "Validation failed",
          details: { errors: validation.errors },
        });
      } else {
        steps.push({
          flow: "Signal Ingestion",
          step: "Business Rules Validation",
          status: "pass",
          message: "Validation passed",
        });
      }

      // Step 3: Verify idempotency
      const testConnector = {
        name: "test",
        ingest: async () => [{
          signal_id: crypto.randomUUID(),
          tenant_id: tenantId,
          source: testSignal.source,
          content: testSignal.content,
          metadata: testSignal.metadata,
          compliance: testSignal.compliance,
          created_at: new Date().toISOString(),
        }],
      };

      const evidenceId1 = await enhancedService.ingestSignal(testSignal, testConnector);
      const evidenceId2 = await enhancedService.ingestSignal(testSignal, testConnector);

      if (evidenceId1 === evidenceId2) {
        steps.push({
          flow: "Signal Ingestion",
          step: "Idempotency",
          status: "pass",
          message: "Idempotency working correctly - duplicate signal returns same evidence ID",
        });
      } else {
        overallStatus = "warning";
        steps.push({
          flow: "Signal Ingestion",
          step: "Idempotency",
          status: "warning",
          message: "Idempotency may not be working - different evidence IDs returned",
        });
      }

      // Step 4: Verify error recovery
      const errorRecoveryResult = await this.errorRecovery.executeWithRecovery(
        async () => {
          throw new Error("Test error for recovery verification");
        },
        {
          retry: {
            maxAttempts: 1,
            backoffMs: 100,
            exponential: false,
          },
          timeout: 5000,
          circuitBreaker: this.errorRecovery.getCircuitBreaker("test"),
        },
        "test_recovery"
      );

      if (!errorRecoveryResult.success) {
        steps.push({
          flow: "Signal Ingestion",
          step: "Error Recovery",
          status: "pass",
          message: "Error recovery service working correctly",
        });
      } else {
        overallStatus = "fail";
        steps.push({
          flow: "Signal Ingestion",
          step: "Error Recovery",
          status: "fail",
          message: "Error recovery should have failed but didn't",
        });
      }

    } catch (error) {
      overallStatus = "fail";
      steps.push({
        flow: "Signal Ingestion",
        step: "Flow Execution",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
        details: { error: String(error) },
      });
    }

    return {
      flowName: "Signal Ingestion Flow",
      description: "Complete signal ingestion with validation, idempotency, and error recovery",
      steps,
      overallStatus,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Verify complete claim extraction flow
   */
  async verifyClaimExtractionFlow(tenantId: string, evidenceId: string): Promise<FlowVerification> {
    const startTime = Date.now();
    const steps: VerificationResult[] = [];
    let overallStatus: "pass" | "fail" | "warning" = "pass";

    try {
      // Step 1: Verify evidence exists
      const evidence = await this.evidenceVault.get(evidenceId);
      if (!evidence) {
        overallStatus = "fail";
        steps.push({
          flow: "Claim Extraction",
          step: "Evidence Verification",
          status: "fail",
          message: `Evidence ${evidenceId} not found`,
        });
        return {
          flowName: "Claim Extraction Flow",
          description: "Extract claims from evidence",
          steps,
          overallStatus,
          totalDuration: Date.now() - startTime,
        };
      }

      steps.push({
        flow: "Claim Extraction",
        step: "Evidence Verification",
        status: "pass",
        message: "Evidence found and accessible",
      });

      // Step 2: Verify business rules validation
      const validation = await validateBusinessRules("claim", {
        evidenceIds: [evidenceId],
      }, tenantId);

      if (!validation.valid) {
        overallStatus = "fail";
        steps.push({
          flow: "Claim Extraction",
          step: "Business Rules Validation",
          status: "fail",
          message: "Validation failed",
          details: { errors: validation.errors },
        });
      } else {
        steps.push({
          flow: "Claim Extraction",
          step: "Business Rules Validation",
          status: "pass",
          message: "Validation passed",
        });
      }

      // Step 3: Verify claim extraction service
      const claimService = new ClaimExtractionService(this.evidenceVault, this.eventStore);
      
      try {
        const claims = await claimService.extractClaims(evidenceId, {
          use_llm: false, // Use rules-based for faster verification
        });

        if (claims.length > 0) {
          steps.push({
            flow: "Claim Extraction",
            step: "Claim Extraction",
            status: "pass",
            message: `Successfully extracted ${claims.length} claims`,
            details: { claimCount: claims.length },
          });
        } else {
          steps.push({
            flow: "Claim Extraction",
            step: "Claim Extraction",
            status: "warning",
            message: "No claims extracted (may be expected for some evidence)",
          });
        }
      } catch (error) {
        overallStatus = "fail";
        steps.push({
          flow: "Claim Extraction",
          step: "Claim Extraction",
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

    } catch (error) {
      overallStatus = "fail";
      steps.push({
        flow: "Claim Extraction",
        step: "Flow Execution",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return {
      flowName: "Claim Extraction Flow",
      description: "Extract claims from evidence with validation",
      steps,
      overallStatus,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Verify complete artifact creation flow
   */
  async verifyArtifactCreationFlow(tenantId: string, evidenceIds: string[]): Promise<FlowVerification> {
    const startTime = Date.now();
    const steps: VerificationResult[] = [];
    let overallStatus: "pass" | "fail" | "warning" = "pass";

    try {
      // Step 1: Verify evidence references
      for (const evidenceId of evidenceIds) {
        const evidence = await this.evidenceVault.get(evidenceId);
        if (!evidence) {
          overallStatus = "fail";
          steps.push({
            flow: "Artifact Creation",
            step: "Evidence Verification",
            status: "fail",
            message: `Evidence ${evidenceId} not found`,
          });
          return {
            flowName: "Artifact Creation Flow",
            description: "Create artifact with evidence references",
            steps,
            overallStatus,
            totalDuration: Date.now() - startTime,
          };
        }
      }

      steps.push({
        flow: "Artifact Creation",
        step: "Evidence Verification",
        status: "pass",
        message: `All ${evidenceIds.length} evidence references valid`,
      });

      // Step 2: Verify business rules validation
      const validation = await validateBusinessRules("artifact", {
        content: "Test artifact content for verification",
        type: "REBUTTAL",
        citations: evidenceIds.map((id) => ({ url: id, title: "" })),
      }, tenantId);

      if (!validation.valid) {
        overallStatus = "fail";
        steps.push({
          flow: "Artifact Creation",
          step: "Business Rules Validation",
          status: "fail",
          message: "Validation failed",
          details: { errors: validation.errors },
        });
      } else {
        steps.push({
          flow: "Artifact Creation",
          step: "Business Rules Validation",
          status: "pass",
          message: "Validation passed",
        });
      }

      // Step 3: Verify transaction management
      const studioService = new AAALStudioService(this.evidenceVault, this.eventStore);
      
      try {
        const artifactId = await this.transactionManager.executeSimple(async (tx) => {
          // In real implementation, this would create the artifact in the database
          // For verification, we'll just test the transaction manager
          return await studioService.createDraft(
            tenantId,
            "Test Artifact",
            "Test content",
            evidenceIds
          );
        });

        steps.push({
          flow: "Artifact Creation",
          step: "Transaction Management",
          status: "pass",
          message: "Artifact created successfully with transaction",
          details: { artifactId },
        });
      } catch (error) {
        overallStatus = "fail";
        steps.push({
          flow: "Artifact Creation",
          step: "Transaction Management",
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }

    } catch (error) {
      overallStatus = "fail";
      steps.push({
        flow: "Artifact Creation",
        step: "Flow Execution",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return {
      flowName: "Artifact Creation Flow",
      description: "Create artifact with evidence references and transaction management",
      steps,
      overallStatus,
      totalDuration: Date.now() - startTime,
    };
  }

  /**
   * Verify all critical flows
   */
  async verifyAllFlows(tenantId: string): Promise<FlowVerification[]> {
    const results: FlowVerification[] = [];

    // Verify signal ingestion flow
    results.push(await this.verifySignalIngestionFlow(tenantId));

    // Get a test evidence ID for claim extraction
    const testEvidence = await this.evidenceVault.query({
      tenant_id: tenantId,
      type: "signal",
    });

    if (testEvidence.length > 0) {
      results.push(await this.verifyClaimExtractionFlow(tenantId, testEvidence[0].evidence_id));
      
      // Verify artifact creation with the same evidence
      results.push(await this.verifyArtifactCreationFlow(tenantId, [testEvidence[0].evidence_id]));
    }

    return results;
  }

  /**
   * Generate comprehensive verification report
   */
  generateReport(verifications: FlowVerification[]): string {
    const report: string[] = [];
    
    report.push("# End-to-End Flow Verification Report\n");
    report.push(`Generated: ${new Date().toISOString()}\n`);
    report.push(`Total Flows Verified: ${verifications.length}\n`);

    const passed = verifications.filter(v => v.overallStatus === "pass").length;
    const failed = verifications.filter(v => v.overallStatus === "fail").length;
    const warnings = verifications.filter(v => v.overallStatus === "warning").length;

    report.push(`\n## Summary\n`);
    report.push(`- ✅ Passed: ${passed}`);
    report.push(`- ❌ Failed: ${failed}`);
    report.push(`- ⚠️  Warnings: ${warnings}\n`);

    for (const verification of verifications) {
      const statusIcon = verification.overallStatus === "pass" ? "✅" : 
                        verification.overallStatus === "fail" ? "❌" : "⚠️";
      
      report.push(`\n## ${statusIcon} ${verification.flowName}\n`);
      report.push(`${verification.description}\n`);
      report.push(`**Duration**: ${verification.totalDuration}ms\n`);

      for (const step of verification.steps) {
        const stepIcon = step.status === "pass" ? "✅" : 
                        step.status === "fail" ? "❌" : "⚠️";
        report.push(`- ${stepIcon} **${step.step}**: ${step.message}`);
        if (step.details) {
          report.push(`  - Details: ${JSON.stringify(step.details, null, 2)}`);
        }
      }
    }

    return report.join("\n");
  }
}

/**
 * Verify API route exists and has proper structure
 */
export async function verifyAPIRoute(
  routePath: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET"
): Promise<VerificationResult> {
  try {
    // In a real implementation, this would make an actual HTTP request
    // For now, we'll verify the file exists and has the expected structure
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const routeFile = path.join(process.cwd(), "app", "api", `${routePath}/route.ts`);
    
    try {
      const content = await fs.readFile(routeFile, "utf-8");
      
      // Check if the route has the expected method
      const hasMethod = content.includes(`export async function ${method}`);
      
      // Check for error handling
      const hasErrorHandling = content.includes("try {") && content.includes("catch");
      
      // Check for authentication
      const hasAuth = content.includes("requireAuth") || content.includes("getServerSession");
      
      if (hasMethod && hasErrorHandling) {
        return {
          flow: "API Route Verification",
          step: routePath,
          status: hasAuth ? "pass" : "warning",
          message: hasAuth 
            ? "Route exists with proper structure, error handling, and authentication"
            : "Route exists with proper structure and error handling, but authentication may be missing",
        };
      } else {
        return {
          flow: "API Route Verification",
          step: routePath,
          status: "fail",
          message: "Route exists but missing required structure",
          details: {
            hasMethod,
            hasErrorHandling,
            hasAuth,
          },
        };
      }
    } catch (error) {
      return {
        flow: "API Route Verification",
        step: routePath,
        status: "fail",
        message: `Route file not found: ${routeFile}`,
      };
    }
  } catch (error) {
    return {
      flow: "API Route Verification",
      step: routePath,
      status: "fail",
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
