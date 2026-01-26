/**
 * Plugin Execution API
 * Execute custom plugins
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { pluginSystem } from "@/lib/extensibility/plugin-system";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { z } from "zod";

const executePluginSchema = z.object({
  pluginId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/plugins/execute - Execute plugin
 */
export async function POST(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";
    const userId = (user as any).id || "";

    const body = await req.json();
    const validated = executePluginSchema.parse(body);

    const result = await pluginSystem.executePlugin(validated.pluginId, {
      tenantId,
      userId,
      input: validated.input ?? {},
      metadata: validated.metadata,
    });

    return NextResponse.json({ result });
  })(request);
}
