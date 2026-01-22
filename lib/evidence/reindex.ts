/**
 * Background Reindex Job for Legacy Evidence Embeddings
 * Processes evidence records that don't have embeddings and generates them
 */

import { db } from "@/lib/db/client";
import { EmbeddingService } from "@/lib/vector/embeddings";
import { ChromaVectorDB } from "@/lib/search/vector-db-chroma";
import { logger } from "@/lib/logging/logger";

export interface ReindexStats {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ evidenceId: string; error: string }>;
}

export class EvidenceReindexService {
  private embeddingService: EmbeddingService;
  private chromaDB: ChromaVectorDB | null = null;
  private batchSize: number = 100;

  constructor() {
    this.embeddingService = new EmbeddingService();

    // Initialize ChromaDB if available
    try {
      const chromaUrl = process.env.CHROMA_URL || "http://localhost:8000";
      const collectionName = process.env.CHROMA_COLLECTION || "holdwall-evidence";
      this.chromaDB = new ChromaVectorDB(chromaUrl, collectionName);
    } catch (error) {
      console.warn("ChromaDB not available for reindex:", error);
    }
  }

  /**
   * Reindex legacy evidence that doesn't have embeddings
   */
  async reindexLegacyEvidence(options?: {
    tenantId?: string;
    batchSize?: number;
    dryRun?: boolean;
    maxRecords?: number;
  }): Promise<ReindexStats> {
    const stats: ReindexStats = {
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    const batchSize = options?.batchSize || this.batchSize;
    const dryRun = options?.dryRun || false;

    logger.info("Starting evidence reindex", {
      tenantId: options?.tenantId,
      batchSize,
      dryRun,
      maxRecords: options?.maxRecords,
    });

    try {
      // Find evidence without embeddings
      const where: any = {
        OR: [
          { embedding: null },
          { embeddingGeneratedAt: null },
        ],
      };

      if (options?.tenantId) {
        where.tenantId = options.tenantId;
      }

      // Get total count
      stats.total = await db.evidence.count({ where });

      if (stats.total === 0) {
        logger.info("No evidence records need reindexing");
        return stats;
      }

      logger.info(`Found ${stats.total} evidence records to reindex`);

      // Process in batches
      let cursor: string | undefined;
      let processedCount = 0;
      const maxRecords = options?.maxRecords || stats.total;

      while (processedCount < maxRecords) {
        const batch = await db.evidence.findMany({
          where: {
            ...where,
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          take: batchSize,
          orderBy: { id: "asc" },
          select: {
            id: true,
            tenantId: true,
            contentRaw: true,
            contentNormalized: true,
            embedding: true,
            embeddingModel: true,
            embeddingGeneratedAt: true,
          },
        });

        if (batch.length === 0) {
          break;
        }

        // Process batch
        for (const evidence of batch) {
          stats.processed++;

          try {
            // Skip if already has embedding
            if (evidence.embedding && evidence.embeddingGeneratedAt) {
              stats.skipped++;
              continue;
            }

            // Get content for embedding
            const content = evidence.contentNormalized || evidence.contentRaw || "";

            if (!content.trim()) {
              stats.skipped++;
              logger.warn("Skipping evidence with no content", { evidenceId: evidence.id });
              continue;
            }

            if (dryRun) {
              logger.info("Dry run: Would reindex evidence", { evidenceId: evidence.id });
              stats.succeeded++;
              continue;
            }

            // Generate embedding
            const embeddingResult = await this.embeddingService.embed(content);

            // Update evidence record
            await db.evidence.update({
              where: { id: evidence.id },
              data: {
                embedding: embeddingResult.vector as any,
                embeddingModel: embeddingResult.model,
                embeddingGeneratedAt: new Date(),
              },
            });

            // Store in ChromaDB if available
            if (this.chromaDB) {
              try {
                await this.chromaDB.add([
                  {
                    id: evidence.id,
                    embedding: embeddingResult.vector,
                    metadata: {
                      tenantId: evidence.tenantId,
                      createdAt: new Date().toISOString(),
                    },
                  },
                ]);
              } catch (error) {
                logger.warn("Failed to store embedding in ChromaDB", {
                  evidenceId: evidence.id,
                  error: (error as Error).message,
                });
                // Continue even if ChromaDB fails
              }
            }

            stats.succeeded++;
            logger.debug("Reindexed evidence", {
              evidenceId: evidence.id,
              model: embeddingResult.model,
              dimensions: embeddingResult.dimensions,
            });

            // Rate limiting: small delay between records
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            stats.failed++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            stats.errors.push({
              evidenceId: evidence.id,
              error: errorMessage,
            });

            logger.error("Failed to reindex evidence", {
              evidenceId: evidence.id,
              error: errorMessage,
            });
          }

          processedCount++;
          cursor = evidence.id;
        }

        // Log progress
        if (stats.processed % (batchSize * 10) === 0) {
          logger.info("Reindex progress", {
            processed: stats.processed,
            total: stats.total,
            succeeded: stats.succeeded,
            failed: stats.failed,
            skipped: stats.skipped,
          });
        }
      }

      logger.info("Reindex completed", {
        total: stats.total,
        processed: stats.processed,
        succeeded: stats.succeeded,
        failed: stats.failed,
        skipped: stats.skipped,
        errorCount: stats.errors.length,
      });

      return stats;
    } catch (error) {
      logger.error("Reindex job failed", {
        error: error instanceof Error ? error.message : String(error),
        stats,
      });
      throw error;
    }
  }

  /**
   * Reindex specific evidence by ID
   */
  async reindexEvidence(evidenceId: string): Promise<void> {
    const evidence = await db.evidence.findUnique({
      where: { id: evidenceId },
      select: {
        id: true,
        tenantId: true,
        contentRaw: true,
        contentNormalized: true,
      },
    });

    if (!evidence) {
      throw new Error(`Evidence not found: ${evidenceId}`);
    }

    const content = evidence.contentNormalized || evidence.contentRaw || "";

    if (!content.trim()) {
      throw new Error(`Evidence has no content: ${evidenceId}`);
    }

    // Generate embedding
    const embeddingResult = await this.embeddingService.embed(content);

    // Update evidence record
    await db.evidence.update({
      where: { id: evidenceId },
      data: {
        embedding: embeddingResult.vector as any,
        embeddingModel: embeddingResult.model,
        embeddingGeneratedAt: new Date(),
      },
    });

    // Store in ChromaDB if available
    if (this.chromaDB) {
      try {
        await this.chromaDB.add([
          {
            id: evidence.id,
            embedding: embeddingResult.vector,
            metadata: {
              tenantId: evidence.tenantId,
              createdAt: new Date().toISOString(),
            },
          },
        ]);
      } catch (error) {
        logger.warn("Failed to store embedding in ChromaDB", {
          evidenceId: evidence.id,
          error: (error as Error).message,
        });
      }
    }

    logger.info("Reindexed evidence", {
      evidenceId,
      model: embeddingResult.model,
    });
  }
}

/**
 * Standalone function for CronJob execution
 */
export async function reindexLegacyEvidence(): Promise<void> {
  const service = new EvidenceReindexService();
  const stats = await service.reindexLegacyEvidence({
    batchSize: 100,
    maxRecords: 1000, // Process up to 1000 records per run
  });

  if (stats.failed > 0) {
    logger.warn("Reindex completed with errors", {
      succeeded: stats.succeeded,
      failed: stats.failed,
      errorCount: stats.errors.length,
    });
  } else {
    logger.info("Reindex completed successfully", {
      processed: stats.processed,
      succeeded: stats.succeeded,
    });
  }
}
