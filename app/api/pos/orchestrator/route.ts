/**
 * POS Orchestrator API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { POSOrchestrator } from "@/lib/pos/orchestrator";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const orchestrator = new POSOrchestrator();

const orchestratorPostSchema = z.object({
  action: z.literal("execute-cycle"),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    if (!tenantId) {
      logger.warn("POS Orchestrator API called without tenantId", {
        userId: (user as any).id,
      });
      return NextResponse.json(
        { error: "Tenant ID is required" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    if (action === "metrics") {
      try {
        const metrics = await orchestrator.getMetrics(tenantId);
        return NextResponse.json({ metrics });
      } catch (error) {
        logger.error("Failed to get POS metrics", {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          { 
            error: "Failed to retrieve metrics",
            details: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    if (action === "recommendations") {
      try {
        const recommendations = await orchestrator.getRecommendations(tenantId);
        return NextResponse.json({ recommendations });
      } catch (error) {
        logger.error("Failed to get POS recommendations", {
          tenantId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          { 
            error: "Failed to retrieve recommendations",
            details: error instanceof Error ? error.message : String(error)
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Invalid action. Valid actions: metrics, recommendations" },
      { status: 400 }
    );
  } catch (error) {
    // Handle auth errors separately
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    logger.error("POS Orchestrator API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Internal server error",
        details: process.env.NODE_ENV === "development" 
          ? (error instanceof Error ? error.stack : undefined)
          : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await request.json();
    const { action } = orchestratorPostSchema.parse(body);

    if (action === "execute-cycle") {
      const result = await orchestrator.executePOSCycle(tenantId);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    const { logger } = await import("@/lib/logging/logger");
    logger.error("POS Orchestrator API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
