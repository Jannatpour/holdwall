/**
 * Case Detail API Routes
 * 
 * GET /api/cases/[id] - Get case details
 * PUT /api/cases/[id] - Update case
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { CaseService } from "@/lib/cases/service";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const caseService = new CaseService();

const updateCaseSchema = z.object({
  status: z.enum(["SUBMITTED", "TRIAGED", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  priority: z.enum(["P0", "P1", "P2", "P3"]).optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  assignedTeam: z.string().optional().nullable(),
  description: z.string().optional(),
  impact: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/cases/[id] - Get case details
 */
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

        const case_ = await caseService.getCase(caseId, tenantId);

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        return NextResponse.json(case_);
      } catch (error) {
        logger.error("Failed to get case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to get case", message: error instanceof Error ? error.message : "Unknown error" },
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

/**
 * PUT /api/cases/[id] - Update case
 */
export async function PUT(
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

        const body = await request.json();
        const validated = updateCaseSchema.parse(body);

        const updated = await caseService.updateCase(caseId, tenantId, validated);

        return NextResponse.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to update case", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to update case", message: error instanceof Error ? error.message : "Unknown error" },
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
