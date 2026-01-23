/**
 * Autonomous Ingestion Automation
 * 
 * Fully autonomous signal ingestion from all sources.
 */

import { PAIAggregator, type PAIData } from "@/lib/collection/pai-aggregator";
import { SignalIngestionService, type Signal, type SignalConnector } from "@/lib/signals/ingestion";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { logger } from "@/lib/logging/logger";

export interface IngestionResult {
  signals_ingested: number;
  evidence_created: number;
  errors: number;
  duration_ms: number;
}

export class IngestionAutomation {
  private paiAggregator: PAIAggregator;
  private signalIngestion: SignalIngestionService;

  constructor() {
    const evidenceVault = new DatabaseEvidenceVault();
    const eventStore = new DatabaseEventStore();
    this.paiAggregator = new PAIAggregator();
    this.signalIngestion = new SignalIngestionService(evidenceVault, eventStore);
  }

  /**
   * Execute autonomous ingestion
   */
  async execute(
    tenantId: string,
    brandName: string
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    let signalsIngested = 0;
    let evidenceCreated = 0;
    let errors = 0;

    try {
      // Aggregate publicly available info (autonomous)
      const pai = await this.paiAggregator.aggregateDefaultSources(brandName);
      signalsIngested = pai.length;

      const connector: SignalConnector = {
        name: "pai-aggregator",
        ingest: async () => [], // not used by ingestSignal
      };

      // Store each item via SignalIngestionService (dedupe, PII handling, events)
      for (const item of pai) {
        try {
          const signal = this.mapPAIToSignal(item, tenantId, brandName);
          await this.signalIngestion.ingestSignal(signal, connector);
          evidenceCreated++;
        } catch (error) {
          errors++;
          logger.warn("Failed to store evidence", {
            error: error instanceof Error ? error.message : String(error),
            source: item.source,
            url: item.metadata.url,
          });
        }
      }

      return {
        signals_ingested: signalsIngested,
        evidence_created: evidenceCreated,
        errors,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Autonomous ingestion failed", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        brand_name: brandName,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        signals_ingested: signalsIngested,
        evidence_created: evidenceCreated,
        errors: errors + 1,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private mapPAIToSignal(item: PAIData, tenantId: string, brandName: string): Omit<Signal, "signal_id" | "created_at"> {
    const sourceId =
      (item.metadata.url as string | undefined) ||
      (item.source.query as string | undefined) ||
      (item.source.platform as string | undefined) ||
      brandName;

    return {
      tenant_id: tenantId,
      source: {
        type: item.source.type,
        id: sourceId,
        url: item.metadata.url as string | undefined,
      },
      content: {
        raw: item.content,
      },
      metadata: {
        ...(item.metadata || {}),
        relevance: item.relevance,
      },
      compliance: {
        source_allowed: true,
        collection_method: "pai_aggregation",
        retention_policy: "standard",
      },
    };
  }
}
