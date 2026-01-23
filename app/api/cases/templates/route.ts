/**
 * Case Templates API
 * 
 * GET /api/cases/templates - List templates
 * POST /api/cases/templates - Create template
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { caseTemplatesService } from "@/lib/cases/templates";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["DISPUTE", "FRAUD_ATO", "OUTAGE_DELAY", "COMPLAINT"]),
  description: z.string().optional(),
  template: z.object({
    description: z.string().optional(),
    impact: z.string().optional(),
    preferredResolution: z.string().optional(),
    evidenceChecklist: z.array(z.string()).optional(),
    defaultSeverity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    defaultPriority: z.enum(["P0", "P1", "P2", "P3"]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const GET = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    try {
      const tenantId = context?.tenantId;

      if (!tenantId) {
        return NextResponse.json(
          { error: "Tenant ID required" },
          { status: 400 }
        );
      }

      const url = new URL(request.url);
      const type = url.searchParams.get("type") as any;

      const templates = await caseTemplatesService.getTemplates(tenantId, type);

      return NextResponse.json({ templates });
    } catch (error) {
      logger.error("Failed to list templates", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to list templates", message: error instanceof Error ? error.message : "Unknown error" },
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

export const POST = createApiHandler(
  async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
    try {
      const tenantId = context?.tenantId;

      if (!tenantId) {
        return NextResponse.json(
          { error: "Tenant ID required" },
          { status: 400 }
        );
      }

      const body = await request.json();
      const validated = createTemplateSchema.parse(body);

      const template = await caseTemplatesService.createTemplate({
        tenantId,
        ...validated,
      });

      return NextResponse.json(template, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation error", details: error.issues },
          { status: 400 }
        );
      }

      logger.error("Failed to create template", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to create template", message: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  },
  {
    requireAuth: true,
    rateLimit: {
      windowMs: 60 * 1000,
      maxRequests: 50,
    },
  }
);
