/**
 * Protocol Security Permissions API
 * Check protocol permissions for agents
 */

import { NextRequest, NextResponse } from "next/server";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const checkPermissionSchema = z.object({
  agentId: z.string(),
  protocol: z.enum(["a2a", "anp", "ag-ui", "ap2", "acp", "mcp"]),
  action: z.string(),
  resource: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validated = checkPermissionSchema.parse(body);

    const protocolSecurity = getProtocolSecurity();
    const hasPermission = await protocolSecurity.checkProtocolPermission(
      validated.agentId,
      validated.protocol,
      validated.action,
      validated.resource
    );

    return NextResponse.json({
      hasPermission,
      agentId: validated.agentId,
      protocol: validated.protocol,
      action: validated.action,
      resource: validated.resource,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Permission check failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Check failed" },
      { status: 500 }
    );
  }
}
