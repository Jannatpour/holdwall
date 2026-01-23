/**
 * Seed Default Templates API
 * 
 * POST /api/cases/templates/seed - Seed default templates for tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { caseTemplatesService } from "@/lib/cases/templates";
import { logger } from "@/lib/logging/logger";

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

        const templates = await caseTemplatesService.seedDefaultTemplates(tenantId);

        return NextResponse.json({
          success: true,
          templatesCreated: templates.length,
          templates,
        });
      } catch (error) {
        logger.error("Failed to seed templates", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to seed templates", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 10,
      },
    }
  );
  return handler(request);
}
