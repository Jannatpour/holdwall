/**
 * Entity Tracker
 * 
 * Tracks entities (people, policies, vendors, organizations) over time
 * to detect ownership changes, policy revisions, and vendor changes.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export type EntityType = "PERSON" | "ORGANIZATION" | "POLICY" | "VENDOR" | "SYSTEM" | "OTHER";

export interface Entity {
  id: string;
  tenant_id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  current_state: Record<string, unknown>;
  state_history: Array<{
    timestamp: string;
    state: Record<string, unknown>;
    changed_by?: string;
    change_reason?: string;
  }>;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EntityChange {
  entity_id: string;
  entity_name: string;
  entity_type: EntityType;
  change_type: "CREATED" | "UPDATED" | "DELETED" | "STATE_CHANGED";
  old_state?: Record<string, unknown>;
  new_state: Record<string, unknown>;
  changed_by?: string;
  changed_at: string;
  change_reason?: string;
}

export class EntityTracker {
  /**
   * Track entity state change
   */
  async trackEntityChange(
    tenantId: string,
    entityType: EntityType,
    entityName: string,
    newState: Record<string, unknown>,
    options?: {
      changed_by?: string;
      change_reason?: string;
      aliases?: string[];
    }
  ): Promise<Entity> {
    try {
      // Find or create entity
      let entity = await db.entity.findFirst({
        where: {
          tenantId,
          type: entityType as any,
          name: entityName,
        },
      });

      const currentTimestamp = new Date().toISOString();

      if (!entity) {
        // Create new entity
        entity = await db.entity.create({
          data: {
            tenantId,
            type: entityType as any,
            name: entityName,
            aliases: options?.aliases || [],
            currentState: newState as any,
            stateHistory: [
              {
                timestamp: currentTimestamp,
                state: newState,
                changed_by: options?.changed_by,
                change_reason: options?.change_reason,
              },
            ] as any,
          },
        });
      } else {
        // Update existing entity
        const oldState = (entity.currentState as Record<string, unknown>) || {};
        const stateHistory = (entity.stateHistory as any[]) || [];

        entity = await db.entity.update({
          where: { id: entity.id },
          data: {
            currentState: newState as any,
            stateHistory: [
              ...stateHistory,
              {
                timestamp: currentTimestamp,
                state: newState,
                changed_by: options?.changed_by,
                change_reason: options?.change_reason,
              },
            ] as any,
            aliases: Array.from(
              new Set([...((entity.aliases as string[]) || []), ...(options?.aliases || [])])
            ),
          },
        });
      }

      // Record change event
      const history = entity.stateHistory ? (entity.stateHistory as unknown as any[]) : [];
      const historyLen = history.length;
      await db.entityEvent.create({
        data: {
          tenantId,
          entityId: entity.id,
          type: historyLen === 1 ? "CREATED" : "STATE_CHANGED",
          oldState: historyLen > 1 ? (history[historyLen - 2] as any).state : undefined,
          newState: newState as any,
          changedBy: options?.changed_by || "system",
          changeReason: options?.change_reason || undefined,
        },
      });

      return this.mapToEntity(entity);
    } catch (error) {
      logger.error("Failed to track entity change", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        entity_type: entityType,
        entity_name: entityName,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get entity by name and type
   */
  async getEntity(
    tenantId: string,
    entityType: EntityType,
    entityName: string
  ): Promise<Entity | null> {
    const entity = await db.entity.findFirst({
      where: {
        tenantId,
        type: entityType as any,
        OR: [
          { name: entityName },
          { aliases: { has: entityName } },
        ],
      },
    });

    if (!entity) {
      return null;
    }

    return this.mapToEntity(entity);
  }

  /**
   * Get entity change history
   */
  async getEntityHistory(
    entityId: string,
    tenantId: string
  ): Promise<EntityChange[]> {
    const events = await db.entityEvent.findMany({
      where: {
        entityId,
        tenantId,
      },
      orderBy: { changedAt: "asc" },
    });

    const entity = await db.entity.findUnique({
      where: { id: entityId },
    });

    if (!entity) {
      return [];
    }

    return events.map((e) => ({
      entity_id: e.entityId,
      entity_name: entity.name,
      entity_type: entity.type as EntityType,
      change_type: e.type as any,
      old_state: (e.oldState as Record<string, unknown>) || undefined,
      new_state: (e.newState as Record<string, unknown>) || {},
      changed_by: e.changedBy,
      changed_at: e.changedAt.toISOString(),
      change_reason: e.changeReason || undefined,
    }));
  }

  /**
   * Map database record to Entity
   */
  private mapToEntity(entity: any): Entity {
    return {
      id: entity.id,
      tenant_id: entity.tenantId,
      type: entity.type as EntityType,
      name: entity.name,
      aliases: (entity.aliases as string[]) || [],
      current_state: (entity.currentState as Record<string, unknown>) || {},
      state_history: ((entity.stateHistory as any[]) || []).map((h: any) => ({
        timestamp: h.timestamp,
        state: h.state,
        changed_by: h.changed_by,
        change_reason: h.change_reason,
      })),
      metadata: (entity.metadata as Record<string, unknown>) || undefined,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
    };
  }
}
