/**
 * Case Comments API
 * 
 * GET /api/cases/[id]/comments - List comments
 * POST /api/cases/[id]/comments - Create comment
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const eventStore = new DatabaseEventStore();

const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  isInternal: z.boolean().default(true),
  parentCommentId: z.string().optional(),
  attachments: z.array(z.any()).optional(),
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

        const comments = await db.caseComment.findMany({
          where: { caseId },
          orderBy: { createdAt: "asc" },
          include: {
            replies: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        return NextResponse.json({ comments });
      } catch (error) {
        logger.error("Failed to get comments", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to get comments", message: error instanceof Error ? error.message : "Unknown error" },
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
        const validated = createCommentSchema.parse(body);

        const comment = await db.caseComment.create({
          data: {
            caseId,
            authorId: context.user.id,
            content: validated.content,
            isInternal: validated.isInternal,
            parentCommentId: validated.parentCommentId,
            attachments: validated.attachments as any,
          },
        });

        // Emit event
        await eventStore.append({
          event_id: crypto.randomUUID(),
          tenant_id: tenantId,
          actor_id: context.user.id,
          type: "case.comment.created",
          occurred_at: new Date().toISOString(),
          correlation_id: caseId,
          schema_version: "1.0",
          evidence_refs: [],
          payload: {
            case_id: caseId,
            comment_id: comment.id,
            is_internal: validated.isInternal,
          },
          signatures: [],
        });

        logger.info("Comment created", {
          tenant_id: tenantId,
          case_id: caseId,
          comment_id: comment.id,
        });

        return NextResponse.json(comment, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to create comment", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to create comment", message: error instanceof Error ? error.message : "Unknown error" },
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
