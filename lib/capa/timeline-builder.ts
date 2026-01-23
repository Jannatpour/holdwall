/**
 * Timeline Builder Service
 * 
 * Extracts and constructs timelines (who/what/when) for claim clusters
 * to answer "what changed" credibly.
 */

import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import type { ChangeEvent, ChangeEventType } from "./service";

export interface TimelineEntry {
  timestamp: string;
  type: "claim" | "action" | "change" | "evidence";
  title: string;
  description: string;
  actor: string;
  metadata?: Record<string, unknown>;
}

export interface Timeline {
  cluster_id: string;
  tenant_id: string;
  entries: TimelineEntry[];
  start_date: string;
  end_date: string;
  summary: {
    total_claims: number;
    total_actions: number;
    total_changes: number;
    key_events: TimelineEntry[];
  };
}

export class TimelineBuilder {
  /**
   * Build timeline for claim cluster
   */
  async buildTimeline(
    clusterId: string,
    tenantId: string
  ): Promise<Timeline> {
    try {
      // Get cluster and claims
      const cluster = await db.claimCluster.findUnique({
        where: { id: clusterId },
        include: {
          claims: {
            orderBy: { createdAt: "asc" },
          },
          correctiveActions: {
            orderBy: { createdAt: "asc" },
          },
          preventiveActions: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!cluster || cluster.tenantId !== tenantId) {
        throw new Error("Cluster not found or tenant mismatch");
      }

      const entries: TimelineEntry[] = [];

      // Add claim entries
      for (const claim of cluster.claims) {
        entries.push({
          timestamp: claim.createdAt.toISOString(),
          type: "claim",
          title: `Claim: ${claim.canonicalText.substring(0, 100)}`,
          description: claim.canonicalText,
          actor: "system",
          metadata: {
            claim_id: claim.id,
            decisiveness: claim.decisiveness,
          },
        });
      }

      // Add corrective action entries
      for (const action of cluster.correctiveActions) {
        entries.push({
          timestamp: action.createdAt.toISOString(),
          type: "action",
          title: `Corrective Action: ${action.title}`,
          description: action.description,
          actor: action.ownerId || "system",
          metadata: {
            action_id: action.id,
            action_type: "corrective",
            status: action.status,
            priority: action.priority,
          },
        });

        if (action.completedAt) {
          entries.push({
            timestamp: action.completedAt.toISOString(),
            type: "action",
            title: `Corrective Action Completed: ${action.title}`,
            description: `Action completed with effectiveness: ${action.effectiveness || "N/A"}`,
            actor: action.ownerId || "system",
            metadata: {
              action_id: action.id,
              action_type: "corrective",
              effectiveness: action.effectiveness,
            },
          });
        }
      }

      // Add preventive action entries
      for (const action of cluster.preventiveActions) {
        entries.push({
          timestamp: action.createdAt.toISOString(),
          type: "action",
          title: `Preventive Action: ${action.title}`,
          description: action.description,
          actor: action.ownerId || "system",
          metadata: {
            action_id: action.id,
            action_type: "preventive",
            status: action.status,
            priority: action.priority,
          },
        });

        if (action.completedAt) {
          entries.push({
            timestamp: action.completedAt.toISOString(),
            type: "action",
            title: `Preventive Action Completed: ${action.title}`,
            description: `Action completed with effectiveness: ${action.effectiveness || "N/A"}`,
            actor: action.ownerId || "system",
            metadata: {
              action_id: action.id,
              action_type: "preventive",
              effectiveness: action.effectiveness,
            },
          });
        }
      }

      // Get change events
      const changeEvents = await db.changeEvent.findMany({
        where: {
          tenantId,
          OR: [
            {
              correctiveAction: {
                clusterId,
              },
            },
            {
              preventiveAction: {
                clusterId,
              },
            },
          ],
        },
        orderBy: { changedAt: "asc" },
      });

      // Add change event entries
      for (const event of changeEvents) {
        entries.push({
          timestamp: event.changedAt.toISOString(),
          type: "change",
          title: `Change: ${event.title}`,
          description: event.description,
          actor: event.changedBy,
          metadata: {
            event_id: event.id,
            event_type: event.type,
            corrective_action_id: event.correctiveActionId,
            preventive_action_id: event.preventiveActionId,
          },
        });
      }

      // Sort entries by timestamp
      entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Get date range
      const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
      const startDate = new Date(Math.min(...timestamps)).toISOString();
      const endDate = new Date(Math.max(...timestamps)).toISOString();

      // Identify key events (actions and changes)
      const keyEvents = entries.filter(
        (e) => e.type === "action" || e.type === "change"
      );

      return {
        cluster_id: clusterId,
        tenant_id: tenantId,
        entries,
        start_date: startDate,
        end_date: endDate,
        summary: {
          total_claims: cluster.claims.length,
          total_actions: cluster.correctiveActions.length + cluster.preventiveActions.length,
          total_changes: changeEvents.length,
          key_events: keyEvents,
        },
      };
    } catch (error) {
      logger.error("Failed to build timeline", {
        error: error instanceof Error ? error.message : String(error),
        cluster_id: clusterId,
        tenant_id: tenantId,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
