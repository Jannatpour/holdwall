/**
 * Knowledge Graph Entities API
 * 
 * Endpoints for entity graph queries
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { EntityKnowledgeGraph } from "@/lib/knowledge/entity-graph";
import { KnowledgeGraphConsistencyChecker } from "@/lib/knowledge/consistency-checker";
import { LongHorizonReasoner } from "@/lib/knowledge/long-horizon-reasoner";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const entityGraph = new EntityKnowledgeGraph();
const consistencyChecker = new KnowledgeGraphConsistencyChecker();
const longHorizonReasoner = new LongHorizonReasoner();

const queryGraphSchema = z.object({
  entity_id: z.string().optional(),
  entity_name: z.string().optional(),
  entity_type: z.enum(["PERSON", "ORGANIZATION", "POLICY", "VENDOR", "SYSTEM", "OTHER"]).optional(),
  relationship_type: z.enum(["OWNS", "CHANGED", "REPORTS_TO", "WORKS_WITH", "SUPPLIES", "MANAGES", "AFFECTED_BY", "RELATED_TO"]).optional(),
  depth: z.number().int().positive().optional(),
});

const extractEntitiesSchema = z.object({
  evidence_id: z.string(),
});

const extractRelationshipsSchema = z.object({
  evidence_id: z.string(),
});

const checkConsistencySchema = z.object({
  tenant_id: z.string().optional(),
});

const predictEntityStateSchema = z.object({
  entity_id: z.string(),
  horizon_days: z.number().int().positive().optional(),
});

const predictNarrativeSchema = z.object({
  cluster_id: z.string(),
  horizon_days: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    if (action === "query") {
      const validated = queryGraphSchema.parse(body);

      const result = await entityGraph.queryGraph(tenant_id, validated);

      return NextResponse.json({
        result,
      });
    }

    if (action === "extract_entities") {
      const validated = extractEntitiesSchema.parse(body);

      const entityIds = await entityGraph.extractEntitiesFromEvidence(
        validated.evidence_id,
        tenant_id
      );

      return NextResponse.json({
        entity_ids: entityIds,
        count: entityIds.length,
      });
    }

    if (action === "extract_relationships") {
      const validated = extractRelationshipsSchema.parse(body);

      const relationships = await entityGraph.extractRelationshipsFromEvidence(
        validated.evidence_id,
        tenant_id
      );

      return NextResponse.json({
        relationships,
        count: relationships.length,
      });
    }

    if (action === "check_consistency") {
      const validated = checkConsistencySchema.parse(body);
      const checkTenantId = validated.tenant_id || tenant_id;

      const result = await consistencyChecker.checkConsistency(checkTenantId);

      return NextResponse.json({
        result,
      });
    }

    if (action === "predict_entity_state") {
      const validated = predictEntityStateSchema.parse(body);

      const prediction = await longHorizonReasoner.predictEntityState(
        validated.entity_id,
        tenant_id,
        validated.horizon_days
      );

      if (!prediction) {
        return NextResponse.json(
          { error: "Entity not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        prediction,
      });
    }

    if (action === "predict_narrative") {
      const validated = predictNarrativeSchema.parse(body);

      const prediction = await longHorizonReasoner.predictNarrativeEvolution(
        validated.cluster_id,
        tenant_id,
        validated.horizon_days
      );

      if (!prediction) {
        return NextResponse.json(
          { error: "Cluster not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        prediction,
      });
    }

    return NextResponse.json(
      {
        error:
          "Invalid action. Use 'query', 'extract_entities', 'extract_relationships', 'check_consistency', 'predict_entity_state', or 'predict_narrative'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Knowledge graph API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
