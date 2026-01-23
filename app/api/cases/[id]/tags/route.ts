/**
 * Case Tags API
 * 
 * GET /api/cases/[id]/tags - List tags for case
 * POST /api/cases/[id]/tags - Add tag to case
 * DELETE /api/cases/[id]/tags/[tagId] - Remove tag from case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

const addTagSchema = z.object({
  tagId: z.string().min(1),
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

        const tagAssignments = await db.caseTagAssignment.findMany({
          where: { caseId },
          include: {
            tag: true,
          },
        });

        return NextResponse.json({ tags: tagAssignments.map((ta) => ta.tag) });
      } catch (error) {
        logger.error("Failed to get tags", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to get tags", message: error instanceof Error ? error.message : "Unknown error" },
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

        if (!context?.user?.id) {
          return NextResponse.json(
            { error: "User ID required" },
            { status: 401 }
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
        const validated = addTagSchema.parse(body);

        // Verify tag belongs to tenant
        const tag = await db.caseTag.findFirst({
          where: { id: validated.tagId, tenantId },
        });

        if (!tag) {
          return NextResponse.json(
            { error: "Tag not found" },
            { status: 404 }
          );
        }

        // Check if already assigned
        const existing = await db.caseTagAssignment.findUnique({
          where: {
            caseId_tagId: {
              caseId,
              tagId: validated.tagId,
            },
          },
        });

        if (existing) {
          return NextResponse.json(
            { error: "Tag already assigned to case" },
            { status: 400 }
          );
        }

        const assignment = await db.caseTagAssignment.create({
          data: {
            caseId,
            tagId: validated.tagId,
            assignedBy: context.user.id,
          },
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context.user.id,
          type: "case.tag.added",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            tag_id: validated.tagId,
          },
          signatures: [],
        });

        logger.info("Tag added to case", {
          tenant_id: tenantId,
          case_id: caseId,
          tag_id: validated.tagId,
        });

        return NextResponse.json(assignment, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to add tag", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to add tag", message: error instanceof Error ? error.message : "Unknown error" },
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tagId: string }> }
) {
  const { id, tagId } = await params;
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

        await db.caseTagAssignment.delete({
          where: {
            caseId_tagId: {
              caseId,
              tagId,
            },
          },
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context?.user?.id || "system",
          type: "case.tag.removed",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            tag_id: tagId,
          },
          signatures: [],
        });

        logger.info("Tag removed from case", {
          tenant_id: tenantId,
          case_id: caseId,
          tag_id: tagId,
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        logger.error("Failed to remove tag", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to remove tag", message: error instanceof Error ? error.message : "Unknown error" },
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
