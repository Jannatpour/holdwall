/**
 * Test Webhook API
 * 
 * POST /api/cases/webhook/test - Test webhook delivery
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { caseWebhooksService } from "@/lib/cases/webhooks";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const testWebhookSchema = z.object({
  webhookId: z.string().min(1),
});

export async function POST(
  request: NextRequest
) {
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

        const body = await request.json();
        const validated = testWebhookSchema.parse(body);

        const result = await caseWebhooksService.testWebhook(validated.webhookId);

        return NextResponse.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to test webhook", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to test webhook", message: error instanceof Error ? error.message : "Unknown error" },
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
