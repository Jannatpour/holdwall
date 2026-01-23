/**
 * Change Detector
 * 
 * Detects changes in narratives and entity states over time.
 */

import { logger } from "@/lib/logging/logger";
import { EmbeddingService } from "@/lib/vector/embeddings";
import { EntityTracker } from "./entity-tracker";

export interface NarrativeChange {
  type: "SENTIMENT_SHIFT" | "VOLUME_CHANGE" | "TOPIC_EMERGENCE" | "TOPIC_DECLINE" | "ENTITY_CHANGE";
  magnitude: number; // 0-1
  description: string;
  timestamp: string;
  evidence_ids: string[];
}

export interface EntityStateChange {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  change_type: string;
  old_state: Record<string, unknown>;
  new_state: Record<string, unknown>;
  changed_at: string;
}

export class ChangeDetector {
  private embeddingService: EmbeddingService;
  private entityTracker: EntityTracker;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.entityTracker = new EntityTracker();
  }

  /**
   * Detect narrative changes
   */
  async detectNarrativeChanges(
    currentContent: string,
    previousContent: string,
    evidenceIds: string[]
  ): Promise<NarrativeChange[]> {
    try {
      const changes: NarrativeChange[] = [];

      // Detect sentiment shift
      const sentimentChange = this.detectSentimentShift(currentContent, previousContent);
      if (sentimentChange.magnitude > 0.3) {
        changes.push({
          type: "SENTIMENT_SHIFT",
          magnitude: sentimentChange.magnitude,
          description: sentimentChange.description,
          timestamp: new Date().toISOString(),
          evidence_ids: evidenceIds,
        });
      }

      // Detect topic changes
      const topicChange = await this.detectTopicChange(currentContent, previousContent);
      if (topicChange.magnitude > 0.3) {
        changes.push({
          type: topicChange.type as any,
          magnitude: topicChange.magnitude,
          description: topicChange.description,
          timestamp: new Date().toISOString(),
          evidence_ids: evidenceIds,
        });
      }

      return changes;
    } catch (error) {
      logger.error("Failed to detect narrative changes", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return [];
    }
  }

  /**
   * Detect entity state changes
   */
  async detectEntityChanges(
    tenantId: string,
    entityType: string,
    entityName: string,
    newState: Record<string, unknown>
  ): Promise<EntityStateChange | null> {
    try {
      const entity = await this.entityTracker.getEntity(
        tenantId,
        entityType as any,
        entityName
      );

      if (!entity) {
        // New entity
        await this.entityTracker.trackEntityChange(
          tenantId,
          entityType as any,
          entityName,
          newState
        );
        return {
          entity_id: "new",
          entity_name: entityName,
          entity_type: entityType,
          change_type: "CREATED",
          old_state: {},
          new_state: newState,
          changed_at: new Date().toISOString(),
        };
      }

      // Compare states
      const oldState = entity.current_state;
      const hasChanges = this.compareStates(oldState, newState);

      if (hasChanges) {
        await this.entityTracker.trackEntityChange(
          tenantId,
          entityType as any,
          entityName,
          newState,
          {
            change_reason: "State change detected",
          }
        );

        return {
          entity_id: entity.id,
          entity_name: entityName,
          entity_type: entityType,
          change_type: "STATE_CHANGED",
          old_state: oldState,
          new_state: newState,
          changed_at: new Date().toISOString(),
        };
      }

      return null;
    } catch (error) {
      logger.error("Failed to detect entity changes", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        entity_type: entityType,
        entity_name: entityName,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Detect sentiment shift
   */
  private detectSentimentShift(current: string, previous: string): {
    magnitude: number;
    description: string;
  } {
    const currentSentiment = this.analyzeSentiment(current);
    const previousSentiment = this.analyzeSentiment(previous);

    const shift = Math.abs(currentSentiment - previousSentiment);
    let description = "";

    if (shift > 0.5) {
      description = currentSentiment > previousSentiment
        ? "Significant positive sentiment shift"
        : "Significant negative sentiment shift";
    } else if (shift > 0.3) {
      description = currentSentiment > previousSentiment
        ? "Moderate positive sentiment shift"
        : "Moderate negative sentiment shift";
    } else {
      description = "Minor sentiment shift";
    }

    return {
      magnitude: shift,
      description,
    };
  }

  /**
   * Detect topic change
   */
  private async detectTopicChange(
    current: string,
    previous: string
  ): Promise<{ type: string; magnitude: number; description: string }> {
    try {
      const currentEmbedding = await this.embeddingService.embed(current);
      const previousEmbedding = await this.embeddingService.embed(previous);
      const similarity = this.embeddingService.cosineSimilarity(
        currentEmbedding.vector,
        previousEmbedding.vector
      );

      if (similarity < 0.5) {
        return {
          type: "TOPIC_EMERGENCE",
          magnitude: 1 - similarity,
          description: "New topic emerged",
        };
      } else if (similarity > 0.9) {
        return {
          type: "TOPIC_DECLINE",
          magnitude: 0,
          description: "Topic remains consistent",
        };
      }

      return {
        type: "TOPIC_EMERGENCE",
        magnitude: 0.3,
        description: "Topic shift detected",
      };
    } catch (error) {
      logger.warn("Failed to detect topic change", {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        type: "TOPIC_EMERGENCE",
        magnitude: 0,
        description: "Topic change detection failed",
      };
    }
  }

  /**
   * Analyze sentiment (simplified)
   */
  private analyzeSentiment(text: string): number {
    // Simple sentiment analysis (in production use proper NLP)
    const positiveWords = ["good", "great", "excellent", "positive", "success", "improve"];
    const negativeWords = ["bad", "terrible", "awful", "negative", "fail", "worse"];

    const lower = text.toLowerCase();
    const positiveCount = positiveWords.filter((w) => lower.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lower.includes(w)).length;

    if (positiveCount === 0 && negativeCount === 0) {
      return 0.5; // Neutral
    }

    return positiveCount / (positiveCount + negativeCount);
  }

  /**
   * Compare states
   */
  private compareStates(
    oldState: Record<string, unknown>,
    newState: Record<string, unknown>
  ): boolean {
    const oldKeys = Object.keys(oldState).sort();
    const newKeys = Object.keys(newState).sort();

    if (oldKeys.length !== newKeys.length) {
      return true;
    }

    for (const key of oldKeys) {
      if (oldState[key] !== newState[key]) {
        return true;
      }
    }

    return false;
  }
}
