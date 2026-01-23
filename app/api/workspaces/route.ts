/**
 * Workspaces API
 * 
 * Endpoints for workspace management (brand/region scoping)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { WorkspaceScopingService } from "@/lib/auth/workspace-scoping";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const workspaceService = new WorkspaceScopingService();

const createWorkspaceSchema = z.object({
  name: z.string(),
  type: z.enum(["BRAND", "REGION", "DEPARTMENT", "PROJECT", "OTHER"]),
  region: z.string().optional(),
  slug: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const assignUserSchema = z.object({
  workspace_id: z.string(),
  user_id: z.string(),
  role: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    if (action === "create") {
      const validated = createWorkspaceSchema.parse(body);

      const workspace = await workspaceService.createWorkspace(
        tenant_id,
        validated.name,
        validated.type as any,
        {
          region: validated.region,
          slug: validated.slug,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        workspace,
      });
    }

    if (action === "assign_user") {
      const validated = assignUserSchema.parse(body);

      const workspaceUser = await workspaceService.assignUserToWorkspace(
        validated.workspace_id,
        validated.user_id,
        tenant_id,
        {
          role: validated.role,
          permissions: validated.permissions,
        }
      );

      return NextResponse.json({
        workspace_user: workspaceUser,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'create' or 'assign_user'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Workspace API error", {
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
    const user_id = (user as any).id || "";

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "user";

    if (scope === "user") {
      const workspaces = await workspaceService.getUserWorkspaces(user_id, tenant_id);

      return NextResponse.json({
        workspaces,
        count: workspaces.length,
      });
    }

    return NextResponse.json(
      { error: "Invalid scope. Use 'user'" },
      { status: 400 }
    );
  } catch (error) {
    logger.error("Workspace API error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
