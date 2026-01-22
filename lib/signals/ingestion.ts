/**
 * Signals Ingestion
 * 
 * Connectors, compliance/provenance, dedupe, language detect, PII redaction, evidence object store.
 */

import type { Evidence, EvidenceVault } from "@/lib/evidence/vault";
import type { EventEnvelope, EventStore } from "@/lib/events/types";
import { LanguageDetectionService } from "./language-detection";
import { PIIDetectionService } from "./pii-detection";
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

  constructor(
    private evidenceVault: EvidenceVault,
    private eventStore: EventStore
  ) {
    this.languageDetector = new LanguageDetectionService();
    this.piiDetector = new PIIDetectionService();
  }

  async ingestSignal(
    signal: Omit<Signal, "signal_id" | "created_at">,
    connector: SignalConnector
  ): Promise<string> {
    // 1. Compliance check
    if (!signal.compliance.source_allowed) {
      throw new Error("Source not allowed by compliance policy");
    }

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
