/**
 * Case Linking API
 * 
 * POST /api/cases/[id]/link - Link related cases
 * GET /api/cases/[id]/link - Get related cases
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

const linkSchema = z.object({
  relatedCaseId: z.string().min(1),
  relationshipType: z.enum(["RELATED", "DUPLICATE", "PARENT", "CHILD", "LINKED"]),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const relationships = await db.caseRelationship.findMany({
          where: { caseId },
          include: {
            relatedCase: {
              select: {
                id: true,
                caseNumber: true,
                type: true,
                status: true,
                severity: true,
                createdAt: true,
              },
            },
          },
        });

        return NextResponse.json({ relationships });
      } catch (error) {
        logger.error("Failed to get related cases", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to get related cases", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    }
  );
  return handler(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const body = await request.json();
        const validated = linkSchema.parse(body);

        // Verify related case belongs to tenant
        const relatedCase = await db.case.findFirst({
          where: { id: validated.relatedCaseId, tenantId },
        });

        if (!relatedCase) {
          return NextResponse.json(
            { error: "Related case not found" },
            { status: 404 }
          );
        }

        if (caseId === validated.relatedCaseId) {
          return NextResponse.json(
            { error: "Cannot link case to itself" },
            { status: 400 }
          );
        }

        // Check if relationship already exists
        const existing = await db.caseRelationship.findUnique({
          where: {
            caseId_relatedCaseId_relationshipType: {
              caseId,
              relatedCaseId: validated.relatedCaseId,
              relationshipType: validated.relationshipType,
            },
          },
        });

        if (existing) {
          return NextResponse.json(
            { error: "Relationship already exists" },
            { status: 400 }
          );
        }

        const relationship = await db.caseRelationship.create({
          data: {
            caseId,
            relatedCaseId: validated.relatedCaseId,
            relationshipType: validated.relationshipType,
          },
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "system",
          type: "case.linked",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            related_case_id: validated.relatedCaseId,
            relationship_type: validated.relationshipType,
          },
          signatures: [],
        });

        logger.info("Case linked", {
          tenant_id: tenantId,
          case_id: caseId,
          related_case_id: validated.relatedCaseId,
          relationship_type: validated.relationshipType,
        });

        return NextResponse.json(relationship, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to link case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to link case", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    }
  );
  return handler(request);
}
