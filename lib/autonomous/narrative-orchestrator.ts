/**
 * Narrative Risk Orchestrator
 *
 * End-to-end autonomous workflow for narrative risk:
 * ingestion → analysis → drafting (human-gated publishing) → measurement.
 */

import { logger } from "@/lib/logging/logger";
import { DatabaseAuditLog } from "@/lib/audit/log-db";
import type { AuditEntry } from "@/lib/audit/lineage";
import type { EventEnvelope } from "@/lib/events/types";
import { randomUUID } from "crypto";
import { IngestionAutomation } from "@/lib/autonomous/ingestion-automation";
import { AnalysisAutomation } from "@/lib/autonomous/analysis-automation";
import { DraftingAutomation } from "@/lib/autonomous/drafting-automation";
import { MeasurementAutomation } from "@/lib/autonomous/measurement-automation";

export interface NarrativeOrchestrationConfig {
  tenant_id: string;
  brand_name: string;
  workspace_id?: string;
  autonomy_level: {
    ingestion: boolean;
    analysis: boolean;
    drafting: boolean;
    measurement: boolean;
    publishing: boolean; // Always human-gated in this orchestrator
  };
  safety_checks: {
    citation_grounded: boolean;
    defamation: boolean;
    privacy: boolean;
    consistency: boolean;
    escalation: boolean;
  };
}

export interface NarrativeOrchestrationResult {
  cycle_id: string;
  tenant_id: string;
  status: "completed" | "pending_approval" | "failed";
  stages: {
    ingestion: {
      signals_processed: number;
      evidence_created: number;
      status: "completed" | "failed";
    };
    analysis: {
      claims_extracted: number;
      clusters_created: number;
      adversarial_patterns_detected: number;
      safety_checks_passed: boolean;
      status: "completed" | "failed";
    };
    drafting: {
      artifacts_drafted: number;
      approvals_required: number;
      status: "completed" | "pending_approval" | "failed";
    };
    measurement: {
      metrics_calculated: boolean;
      citation_capture_tracked: boolean;
      status: "completed" | "failed";
    };
  };
  created_at: string;
}

export class NarrativeOrchestrator {
  private auditLog: DatabaseAuditLog;
  private ingestionAutomation: IngestionAutomation;
  private analysisAutomation: AnalysisAutomation;
  private draftingAutomation: DraftingAutomation;
  private measurementAutomation: MeasurementAutomation;
  private config: NarrativeOrchestrationConfig;

  constructor(config: NarrativeOrchestrationConfig) {
    this.config = config;
    this.auditLog = new DatabaseAuditLog();
    this.ingestionAutomation = new IngestionAutomation();
    this.analysisAutomation = new AnalysisAutomation();
    this.draftingAutomation = new DraftingAutomation();
    this.measurementAutomation = new MeasurementAutomation();
  }

  async executeCycle(): Promise<NarrativeOrchestrationResult> {
    const cycleId = randomUUID();
    const startTime = Date.now();

    logger.info("Starting narrative orchestration cycle", {
      cycle_id: cycleId,
      tenant_id: this.config.tenant_id,
      brand_name: this.config.brand_name,
      workspace_id: this.config.workspace_id,
    });

    const stages: NarrativeOrchestrationResult["stages"] = {
      ingestion: { signals_processed: 0, evidence_created: 0, status: "failed" },
      analysis: {
        claims_extracted: 0,
        clusters_created: 0,
        adversarial_patterns_detected: 0,
        safety_checks_passed: false,
        status: "failed",
      },
      drafting: { artifacts_drafted: 0, approvals_required: 0, status: "failed" },
      measurement: { metrics_calculated: false, citation_capture_tracked: false, status: "failed" },
    };

    await this.appendAuditEvent("narrative.cycle.started", cycleId, {
      brand_name: this.config.brand_name,
      workspace_id: this.config.workspace_id,
    }).catch(() => undefined);

    try {
      if (this.config.autonomy_level.ingestion) {
        const ingestion = await this.ingestionAutomation.execute(this.config.tenant_id, this.config.brand_name);
        stages.ingestion = {
          signals_processed: ingestion.signals_ingested,
          evidence_created: ingestion.evidence_created,
          status: "completed",
        };
      }

      if (this.config.autonomy_level.analysis) {
        const analysis = await this.analysisAutomation.execute(this.config.tenant_id);
        stages.analysis = {
          claims_extracted: analysis.claims_extracted,
          clusters_created: analysis.clusters_created,
          adversarial_patterns_detected: analysis.adversarial_detections,
          safety_checks_passed: analysis.safety_checks_passed,
          status: "completed",
        };
      }

      if (this.config.autonomy_level.drafting) {
        // Always human-gated: this orchestrator will never publish autonomously.
        const drafting = await this.draftingAutomation.execute(
          this.config.tenant_id,
          this.config.workspace_id,
          false
        );
        stages.drafting = {
          artifacts_drafted: drafting.artifacts_drafted,
          approvals_required: drafting.approvals_required,
          status: drafting.approvals_required > 0 ? "pending_approval" : "completed",
        };
      }

      if (this.config.autonomy_level.measurement) {
        const measurement = await this.measurementAutomation.execute(this.config.tenant_id);
        stages.measurement = {
          metrics_calculated: true,
          citation_capture_tracked: measurement.ai_citation_capture_rate > 0,
          status: "completed",
        };
      }

      const status: NarrativeOrchestrationResult["status"] =
        stages.drafting.status === "pending_approval"
          ? "pending_approval"
          : stages.ingestion.status === "failed" ||
              stages.analysis.status === "failed" ||
              stages.drafting.status === "failed" ||
              stages.measurement.status === "failed"
            ? "failed"
            : "completed";

      const result: NarrativeOrchestrationResult = {
        cycle_id: cycleId,
        tenant_id: this.config.tenant_id,
        status,
        stages,
        created_at: new Date().toISOString(),
      };

      await this.appendAuditEvent("narrative.cycle.completed", cycleId, {
        status,
        duration_ms: Date.now() - startTime,
      }).catch(() => undefined);

      logger.info("Narrative orchestration cycle completed", {
        cycle_id: cycleId,
        status,
        duration_ms: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("Narrative orchestration cycle failed", {
        error: message,
        cycle_id: cycleId,
        tenant_id: this.config.tenant_id,
        stack: error instanceof Error ? error.stack : undefined,
      });

      await this.appendAuditEvent("narrative.cycle.failed", cycleId, { error: message }).catch(() => undefined);

      return {
        cycle_id: cycleId,
        tenant_id: this.config.tenant_id,
        status: "failed",
        stages,
        created_at: new Date().toISOString(),
      };
    }
  }

  private async appendAuditEvent(
    eventType: string,
    correlationId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const envelope: EventEnvelope = {
      event_id: randomUUID(),
      tenant_id: this.config.tenant_id,
      actor_id: "narrative-orchestrator",
      type: eventType,
      occurred_at: new Date().toISOString(),
      correlation_id: correlationId,
      schema_version: "1.0",
      evidence_refs: [],
      payload,
      signatures: [],
    };

    const entry: AuditEntry = {
      audit_id: randomUUID(),
      timestamp: new Date().toISOString(),
      type: "event",
      tenant_id: this.config.tenant_id,
      actor_id: "narrative-orchestrator",
      correlation_id: correlationId,
      data: envelope,
      evidence_refs: [],
    };

    await this.auditLog.append(entry);
  }
}

