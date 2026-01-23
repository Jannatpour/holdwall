/**
 * Bulk Operations API
 * 
 * POST /api/cases/bulk - Perform bulk operations on cases
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { db } from "@/lib/db/client";
import { CaseService } from "@/lib/cases/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();
const eventStore = new DatabaseEventStore();

const bulkOperationSchema = z.object({
  action: z.enum(["assign", "update_status", "update_priority", "add_tag", "remove_tag", "export", "delete"]),
  caseIds: z.array(z.string()).min(1).max(100),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
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

        const body = await request.json();
        const validated = bulkOperationSchema.parse(body);

        // Verify all cases belong to tenant
        const cases = await db.case.findMany({
          where: {
            id: { in: validated.caseIds },
            tenantId,
          },
        });

        if (cases.length !== validated.caseIds.length) {
          return NextResponse.json(
            { error: "Some cases not found or do not belong to tenant" },
            { status: 400 }
          );
        }

        const results: Array<{ caseId: string; success: boolean; error?: string }> = [];

        switch (validated.action) {
          case "assign":
            await bulkAssign(cases, validated.parameters, context.user.id, results);
            break;

          case "update_status":
            await bulkUpdateStatus(cases, validated.parameters, results);
            break;

          case "update_priority":
            await bulkUpdatePriority(cases, validated.parameters, results);
            break;

          case "add_tag":
            await bulkAddTag(cases, validated.parameters, context.user.id, results);
            break;

          case "remove_tag":
            await bulkRemoveTag(cases, validated.parameters, results);
            break;

          case "export":
            return await bulkExport(cases, tenantId);

          case "delete":
            await bulkDelete(cases, tenantId, results);
            break;

          default:
            return NextResponse.json(
              { error: "Invalid action" },
              { status: 400 }
            );
        }

        const successCount = results.filter((r) => r.success).length;
        const failureCount = results.filter((r) => !r.success).length;

        logger.info("Bulk operation completed", {
          tenant_id: tenantId,
          action: validated.action,
          total: validated.caseIds.length,
          success: successCount,
          failures: failureCount,
        });

        return NextResponse.json({
          success: true,
          action: validated.action,
          total: validated.caseIds.length,
          successCount,
          failureCount,
          results,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to perform bulk operation", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to perform bulk operation", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 20, // Lower limit for bulk operations
      },
    }
  );
  return handler(request);
}

/**
 * Bulk assign cases
 */
const bulkAssign = async (
  cases: Array<{ id: string }>,
  parameters: Record<string, unknown> | undefined,
  userId: string,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> => {
  const assigneeId = parameters?.assigneeId as string | undefined;
  const team = parameters?.team as string | undefined;

  if (!assigneeId && !team) {
    for (const case_ of cases) {
      results.push({
        caseId: case_.id,
        success: false,
        error: "assigneeId or team required",
      });
    }
    return;
  }

  for (const case_ of cases) {
    try {
      await db.case.update({
        where: { id: case_.id },
        data: {
          assignedTo: assigneeId || null,
          assignedTeam: team || null,
        },
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

/**
 * Bulk update status
 */
const bulkUpdateStatus = async (
  cases: Array<{ id: string }>,
  parameters: Record<string, unknown> | undefined,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> => {
  const status = parameters?.status as string | undefined;

  if (!status) {
    for (const case_ of cases) {
      results.push({
        caseId: case_.id,
        success: false,
        error: "status required",
      });
    }
    return;
  }

  for (const case_ of cases) {
    try {
      await db.case.update({
        where: { id: case_.id },
        data: {
          status: status as any,
          ...(status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        },
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

/**
 * Bulk update priority
 */
async function bulkUpdatePriority(
  cases: Array<{ id: string }>,
  parameters: Record<string, unknown> | undefined,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> {
  const priority = parameters?.priority as string | null | undefined;

  for (const case_ of cases) {
    try {
      await db.case.update({
        where: { id: case_.id },
        data: {
          priority: priority as any,
        },
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

/**
 * Bulk add tag
 */
const bulkAddTag = async (
  cases: Array<{ id: string }>,
  parameters: Record<string, unknown> | undefined,
  userId: string,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> => {
  const tagId = parameters?.tagId as string | undefined;

  if (!tagId) {
    for (const case_ of cases) {
      results.push({
        caseId: case_.id,
        success: false,
        error: "tagId required",
      });
    }
    return;
  }

  for (const case_ of cases) {
    try {
      await db.caseTagAssignment.upsert({
        where: {
          caseId_tagId: {
            caseId: case_.id,
            tagId: tagId,
          },
        },
        create: {
          caseId: case_.id,
          tagId,
          assignedBy: userId,
        },
        update: {},
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

/**
 * Bulk remove tag
 */
const bulkRemoveTag = async (
  cases: Array<{ id: string }>,
  parameters: Record<string, unknown> | undefined,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> => {
  const tagId = parameters?.tagId as string | undefined;

  if (!tagId) {
    for (const case_ of cases) {
      results.push({
        caseId: case_.id,
        success: false,
        error: "tagId required",
      });
    }
    return;
  }

  for (const case_ of cases) {
    try {
      await db.caseTagAssignment.deleteMany({
        where: {
          caseId: case_.id,
          tagId,
        },
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};

/**
 * Bulk export cases
 */
const bulkExport = async (
  cases: Array<{ id: string }>,
  tenantId: string
): Promise<NextResponse> => {
  // Get full case data
  const fullCases = await db.case.findMany({
    where: {
      id: { in: cases.map((c) => c.id) },
      tenantId,
    },
    include: {
      resolution: true,
      evidence: {
        include: {
          evidence: {
            select: {
              id: true,
              type: true,
            },
          },
        },
      },
      comments: {
        take: 10,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    tenantId,
    totalCases: fullCases.length,
    cases: fullCases.map((case_) => ({
      id: case_.id,
      caseNumber: case_.caseNumber,
      type: case_.type,
      status: case_.status,
      severity: case_.severity,
      priority: case_.priority,
      submittedBy: case_.submittedBy,
      description: case_.description,
      impact: case_.impact,
      createdAt: case_.createdAt,
      updatedAt: case_.updatedAt,
      resolution: case_.resolution,
      evidenceCount: case_.evidence.length,
      commentsCount: case_.comments.length,
    })),
  };

  return NextResponse.json(exportData, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="cases-export-${Date.now()}.json"`,
    },
  });
};

/**
 * Bulk delete cases (soft delete by closing)
 */
const bulkDelete = async (
  cases: Array<{ id: string }>,
  tenantId: string,
  results: Array<{ caseId: string; success: boolean; error?: string }>
): Promise<void> => {
  for (const case_ of cases) {
    try {
      await db.case.update({
        where: { id: case_.id },
        data: {
          status: "CLOSED",
        },
      });

      results.push({ caseId: case_.id, success: true });
    } catch (error) {
      results.push({
        caseId: case_.id,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
};
