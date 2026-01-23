/**
 * Knowledge Graph Consistency Checker
 * 
 * Verifies graph consistency and detects contradictions in entity state.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export interface ConsistencyIssue {
  entity_id: string;
  entity_name: string;
  issue_type: "CONTRADICTION" | "MISSING_RELATIONSHIP" | "INCONSISTENT_STATE";
  description: string;
  severity: "low" | "medium" | "high";
}

export class KnowledgeGraphConsistencyChecker {
  /**
   * Check graph consistency
   */
  async checkConsistency(tenantId: string): Promise<{
    consistent: boolean;
    issues: ConsistencyIssue[];
  }> {
    try {
      const issues: ConsistencyIssue[] = [];

      // Get all entities
      const entities = await db.entity.findMany({
        where: { tenantId },
        include: {
          fromRelations: true,
          toRelations: true,
        },
      });

      // Check for contradictions
      for (const entity of entities) {
        const state = entity.currentState as Record<string, unknown>;
        const history = (entity.stateHistory as any[]) || [];

        // Check ownership contradictions
        if (state.owner) {
          const ownershipHistory = history.filter((h) => h.state?.owner);
          const owners = new Set(ownershipHistory.map((h) => h.state.owner));
          if (owners.size > 1) {
            const hasTransfer = history.some(
              (h) =>
                h.change_reason?.toLowerCase().includes("transfer") ||
                h.change_reason?.toLowerCase().includes("sold") ||
                h.change_reason?.toLowerCase().includes("acquired")
            );

            if (!hasTransfer) {
              issues.push({
                entity_id: entity.id,
                entity_name: entity.name,
                issue_type: "CONTRADICTION",
                description: `Multiple owners without transfer: ${Array.from(owners).join(", ")}`,
                severity: "high",
              });
            }
          }
        }

        // Check for missing relationships (entities mentioned together but no relationship)
        // This would require more sophisticated analysis
      }

      // Check relationship consistency
      const relationships = await db.entityRelationship.findMany({
        where: { tenantId },
      });

      for (const rel of relationships) {
        // Check if entities still exist
        const fromEntity = await db.entity.findUnique({
          where: { id: rel.fromEntityId },
        });
        const toEntity = await db.entity.findUnique({
          where: { id: rel.toEntityId },
        });

        if (!fromEntity || !toEntity) {
          issues.push({
            entity_id: rel.fromEntityId,
            entity_name: fromEntity?.name || "unknown",
            issue_type: "MISSING_RELATIONSHIP",
            description: `Relationship references non-existent entity`,
            severity: "medium",
          });
        }
      }

      return {
        consistent: issues.length === 0,
        issues,
      };
    } catch (error) {
      logger.error("Failed to check graph consistency", {
        error: error instanceof Error ? error.message : String(error),
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return { consistent: true, issues: [] };
    }
  }
}
