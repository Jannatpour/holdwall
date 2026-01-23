/**
 * Case Webhooks API
 * 
 * POST /api/cases/webhook - Handle inbound webhook
 * GET /api/cases/webhook - List webhook configurations
 * POST /api/cases/webhook/config - Create webhook configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { caseWebhooksService } from "@/lib/cases/webhooks";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const inboundWebhookSchema = z.object({
  source: z.string().min(1),
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  signature: z.string().optional(),
  timestamp: z.string().optional(),
});

const createWebhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().optional(),
});

/**
 * POST /api/cases/webhook - Handle inbound webhook
 * 
 * Public endpoint for receiving webhooks from external systems.
 */
export async function POST(request: NextRequest) {
  try {
    // Get tenant ID from header or query param
    const tenantId = request.headers.get("X-Tenant-ID") || 
                     new URL(request.url).searchParams.get("tenant_id");

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = inboundWebhookSchema.parse(body);

    // Get webhook secret if configured
    const signature = request.headers.get("X-Holdwall-Signature") || validated.signature;
    const webhookConfig = await db.caseWebhook.findFirst({
      where: {
        tenantId,
        enabled: true,
      },
    });

    const secret = webhookConfig?.secret || undefined;

    // Handle webhook
    const result = await caseWebhooksService.handleInboundWebhook(
      tenantId,
      validated.source,
      validated.event,
      validated.payload,
      signature,
      secret
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      case_id: result.caseId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Failed to process inbound webhook", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to process webhook", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/webhook - List webhook configurations
 */
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

      const webhooks = await db.caseWebhook.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ webhooks });
    } catch (error) {
      logger.error("Failed to list webhooks", {
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        { error: "Failed to list webhooks", message: error instanceof Error ? error.message : "Unknown error" },
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

/**
 * POST /api/cases/webhook/config - Create webhook configuration
 */
export async function PUT(request: NextRequest) {
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
        const validated = createWebhookSchema.parse(body);

        const webhook = await caseWebhooksService.createWebhook(
          tenantId,
          validated.name,
          validated.url,
          validated.events,
          validated.secret
        );

        return NextResponse.json(webhook, { status: 201 });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to create webhook", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to create webhook", message: error instanceof Error ? error.message : "Unknown error" },
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
