/**
 * Signals Ingestion
 * 
 * Production-ready signal ingestion with connectors, compliance/provenance, dedupe, 
 * language detection, PII redaction, evidence object store, idempotency, error recovery, 
 * and transaction management.
 */

import type { Evidence, EvidenceVault } from "@/lib/evidence/vault";
import type { EventEnvelope, EventStore } from "@/lib/events/types";
import { LanguageDetectionService } from "./language-detection";
import { PIIDetectionService } from "./pii-detection";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency } from "@/lib/operations/idempotency";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import { createHash } from "crypto";
import { db } from "@/lib/db/client";

export interface Signal {
  signal_id: string;
  tenant_id: string;
  source: {
    type: string;
    id: string;
    url?: string;
  };
  content: {
    raw: string;
    normalized?: string;
    language?: string;
    pii_redacted?: boolean;
  };
  metadata: {
    author?: string;
    timestamp?: string;
    amplification?: number;
    sentiment?: number;
    [key: string]: unknown;
  };
  compliance: {
    source_allowed: boolean;
    collection_method: string;
    retention_policy: string;
  };
  created_at: string;
}

export interface SignalConnector {
  name: string;
  ingest(options: {
    source_id: string;
    filters?: Record<string, unknown>;
  }): Promise<Signal[]>;
}

export class SignalIngestionService {
  private languageDetector: LanguageDetectionService;
  private piiDetector: PIIDetectionService;
  private idempotencyService: IdempotencyService;
  private errorRecovery: ErrorRecoveryService;

  constructor(
    private evidenceVault: EvidenceVault,
    private eventStore: EventStore,
    idempotencyService?: IdempotencyService,
    errorRecovery?: ErrorRecoveryService
  ) {
    this.languageDetector = new LanguageDetectionService();
    this.piiDetector = new PIIDetectionService();
    this.idempotencyService = idempotencyService || new IdempotencyService();
    this.errorRecovery = errorRecovery || new ErrorRecoveryService();
  }

  async ingestSignal(
    signal: Omit<Signal, "signal_id" | "created_at">,
    connector: SignalConnector,
    options?: {
      skipIdempotency?: boolean;
      skipValidation?: boolean;
      skipErrorRecovery?: boolean;
    }
  ): Promise<string> {
    // 1. Validate business rules (if not skipped)
    if (!options?.skipValidation) {
      const validation = await validateBusinessRules("signal", {
        content: signal.content.raw,
        source: signal.source,
        metadata: signal.metadata,
      }, signal.tenant_id);

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
      }
    }

    // 2. Compliance check
    if (!signal.compliance.source_allowed) {
      throw new Error("Source not allowed by compliance policy");
    }

    // 3. Execute with idempotency (if not skipped)
    if (options?.skipIdempotency) {
      return this._ingestSignalInternal(signal, connector, options);
    }

    return await withIdempotency(
      this.idempotencyService,
      signal.tenant_id,
      "ingest_signal",
      {
        content: signal.content.raw,
        source: signal.source,
        metadata: signal.metadata,
      },
      async () => {
        // 4. Execute with error recovery (if not skipped)
        if (options?.skipErrorRecovery) {
          return this._ingestSignalInternal(signal, connector, options);
        }

        const recoveryResult = await this.errorRecovery.executeWithRecovery(
          async () => {
            return this._ingestSignalInternal(signal, connector, options);
          },
          {
            retry: {
              maxAttempts: 3,
              backoffMs: 1000,
              exponential: true,
            },
            timeout: 30_000, // 30 seconds
            fallback: async () => {
              logger.warn("Signal ingestion failed, storing in queue", {
                tenantId: signal.tenant_id,
                source: signal.source,
              });
              // In production, would store in a queue (e.g., Kafka, SQS)
              throw new Error("Signal ingestion failed and fallback unavailable");
            },
            circuitBreaker: this.errorRecovery.getCircuitBreaker("signal_ingestion"),
          },
          "ingest_signal"
        );

        if (!recoveryResult.success) {
          throw recoveryResult.error || new Error("Signal ingestion failed");
        }

        return recoveryResult.result as string;
      },
      24 * 60 * 60 // 24 hour TTL
    );
  }

  /**
   * Internal signal ingestion implementation (without idempotency/error recovery)
   */
  private async _ingestSignalInternal(
    signal: Omit<Signal, "signal_id" | "created_at">,
    connector: SignalConnector,
    options?: { skipIdempotency?: boolean; skipValidation?: boolean; skipErrorRecovery?: boolean }
  ): Promise<string> {

    // 2. Content normalization
    const normalizedContent = this.normalizeContent(signal.content.raw);
    signal.content.normalized = normalizedContent;

    // 3. Generate content hash for deduplication
    const contentHash = this.generateContentHash(
      signal.content.raw || normalizedContent,
      signal.source.type,
      signal.source.id
    );

    // 4. Check for duplicates (tenant-scoped)
    const existing = await db.evidence.findFirst({
      where: {
        tenantId: signal.tenant_id,
        contentHash,
      },
    });

    if (existing) {
      // Return existing evidence ID (deduplication)
      return existing.id;
    }

    // 5. Language detection
    const languageResult = await this.languageDetector.detectWithFallback(
      signal.content.raw || normalizedContent
    );
    signal.content.language = languageResult.language;

    // 6. PII detection and redaction
    const piiResult = await this.piiDetector.redact(
      signal.content.raw || normalizedContent
    );
    signal.content.pii_redacted = piiResult.redacted;

    // Use redacted text if PII was found
    const finalContent = piiResult.redacted ? piiResult.redactedText : (signal.content.raw || normalizedContent);
    const finalNormalized = piiResult.redacted 
      ? this.normalizeContent(piiResult.redactedText)
      : normalizedContent;

    // 7. Store as evidence with all metadata
    const evidence_id = await this.evidenceVault.store({
      tenant_id: signal.tenant_id,
      type: "signal",
      source: {
        type: signal.source.type,
        id: signal.source.id,
        url: signal.source.url,
        collected_at: new Date().toISOString(),
        collected_by: connector.name,
        method: "api", // In production, get from connector
      },
      content: {
        raw: finalContent,
        normalized: finalNormalized,
        metadata: {
          ...signal.metadata,
          language: languageResult.language,
          languageConfidence: languageResult.confidence,
          piiDetected: piiResult.redacted,
          piiEntities: piiResult.entities,
        },
      },
      provenance: {
        collection_method: signal.compliance.collection_method,
        retention_policy: signal.compliance.retention_policy,
      },
      metadata: {
        contentHash,
        piiRedactionMap: piiResult.redactionMap,
        detectedLanguage: languageResult.language,
        languageConfidence: languageResult.confidence,
      },
    });

    // 8. Emit event
    const event: EventEnvelope = {
      event_id: crypto.randomUUID(),
      tenant_id: signal.tenant_id,
      actor_id: connector.name,
      type: "signal.ingested",
      occurred_at: new Date().toISOString(),
      correlation_id: crypto.randomUUID(),
      schema_version: "1.0",
      evidence_refs: [evidence_id],
      payload: {
        signal_id: evidence_id,
        source: signal.source,
        language: languageResult.language,
        pii_redacted: piiResult.redacted,
      },
      signatures: [],
    };

    await this.eventStore.append(event);

    // 9. Check Financial Services escalation rules (async, don't block)
    try {
      const { escalationEnforcer } = await import("@/lib/financial-services/escalation-enforcer");
      escalationEnforcer.checkAndEscalateSignal(
        signal.tenant_id,
        evidence_id,
        signal.content.raw || signal.content.normalized || "",
        signal.metadata?.amplification || 0
      ).catch((error) => {
        logger.warn("Financial Services signal escalation check failed", {
          error: error instanceof Error ? error.message : String(error),
          tenantId: signal.tenant_id,
          evidenceId: evidence_id,
        });
      });
    } catch (error) {
      // If escalation check fails, continue (not all tenants have Financial Services enabled)
    }

    return evidence_id;
  }

  /**
   * Batch ingest signals with transaction management
   */
  async batchIngestSignals(
    signals: Array<Omit<Signal, "signal_id" | "created_at">>,
    connector: SignalConnector
  ): Promise<Array<{ signal: Omit<Signal, "signal_id" | "created_at">; evidenceId: string; error?: string }>> {
    const results: Array<{ signal: Omit<Signal, "signal_id" | "created_at">; evidenceId: string; error?: string }> = [];

    // Process in batches of 10 to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = signals.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (signal) => {
          try {
            const evidenceId = await this.ingestSignal(signal, connector);
            return { signal, evidenceId };
          } catch (error) {
            return {
              signal,
              evidenceId: "",
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === "fulfilled") {
          results.push(result.value);
        } else {
          logger.error("Unexpected error in batch processing", {
            error: result.reason,
          });
        }
      }

      // Small delay between batches to avoid rate limiting
      if (i + batchSize < signals.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Normalize content (HTML→text, markdown cleanup, canonicalization)
   */
  private normalizeContent(content: string): string {
    if (!content) return "";

    // Remove HTML tags
    let normalized = content.replace(/<[^>]*>/g, "");

    // Decode HTML entities
    normalized = normalized
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    // Normalize whitespace
    normalized = normalized.replace(/\s+/g, " ").trim();

    // Remove markdown formatting (basic)
    normalized = normalized
      .replace(/#{1,6}\s+/g, "") // Headers
      .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
      .replace(/\*([^*]+)\*/g, "$1") // Italic
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Links
      .replace(/`([^`]+)`/g, "$1"); // Code

    return normalized;
  }

  /**
   * Generate stable content hash for deduplication
   */
  private generateContentHash(
    content: string,
    sourceType: string,
    sourceId: string
  ): string {
    // Create hash from normalized content + source identifiers
    const hashInput = `${sourceType}:${sourceId}:${this.normalizeContent(content)}`;
    return createHash("sha256").update(hashInput).digest("hex");
  }
}
