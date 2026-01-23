/**
 * Customer Resolution API
 * 
 * Endpoints for customer resolution operations
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CustomerResolutionService } from "@/lib/resolution/service";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const resolutionService = new CustomerResolutionService();

const createResolutionSchema = z.object({
  cluster_id: z.string(),
  type: z.enum(["REFUND", "ESCALATION", "SUPPORT_TICKET", "APOLOGY", "CLARIFICATION"]),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  customer_info: z
    .object({
      email: z.string().email().optional(),
      name: z.string().optional(),
      account_id: z.string().optional(),
    })
    .optional(),
  assigned_to: z.string().optional(),
  sla_hours: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createRemediationSchema = z.object({
  resolution_id: z.string(),
  action_type: z.string(),
  description: z.string(),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const routeResolutionSchema = z.object({
  resolution_id: z.string(),
});

const getResolutionsSchema = z.object({
  cluster_id: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const actor_id = (user as any).id || "";

    const body = await request.json();
    const action = body.action;

    if (action === "create") {
      const validated = createResolutionSchema.parse(body);

      const resolution = await resolutionService.createResolution(
        tenant_id,
        validated.cluster_id,
        validated.type as any,
        validated.title,
        validated.description,
        {
          priority: validated.priority as any,
          customer_info: validated.customer_info,
          assigned_to: validated.assigned_to,
          sla_hours: validated.sla_hours,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        resolution,
      });
    }

    if (action === "create_remediation") {
      const validated = createRemediationSchema.parse(body);

      const remediation = await resolutionService.createRemediationAction(
        validated.resolution_id,
        tenant_id,
        validated.action_type,
        validated.description,
        {
          assigned_to: validated.assigned_to,
          due_date: validated.due_date ? new Date(validated.due_date) : undefined,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        remediation,
      });
    }

    if (action === "route") {
      const validated = routeResolutionSchema.parse(body);

      const routing = await resolutionService.routeResolution(
        validated.resolution_id,
        tenant_id
      );

      return NextResponse.json({
        routing,
      });
    }

    return NextResponse.json(
      {
        error: "Invalid action. Use 'create', 'create_remediation', or 'route'",
      },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Resolution API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const { searchParams } = new URL(request.url);
    const cluster_id = searchParams.get("cluster_id");

    if (!cluster_id) {
      return NextResponse.json({ error: "cluster_id is required" }, { status: 400 });
    }

    const validated = getResolutionsSchema.parse({ cluster_id });

    const resolutions = await resolutionService.getResolutionsForCluster(
      validated.cluster_id,
      tenant_id
    );

    return NextResponse.json({
      resolutions,
      count: resolutions.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Resolution API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
