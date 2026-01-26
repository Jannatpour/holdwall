/**
 * Plugin System API
 * Manage custom plugins/extensions for maximum system flexibility
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { pluginSystem } from "@/lib/extensibility/plugin-system";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";
import type { PluginType } from "@/lib/extensibility/plugin-system";

const installPluginSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["workflow_action", "business_rule", "integration", "ai_model", "data_transform", "custom_handler", "validator", "notifier", "analyzer"]),
  version: z.string(),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()),
  handler: z.string(),
  enabled: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const executePluginSchema = z.object({
  pluginId: z.string(),
  input: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/plugins - List plugins
 */
export async function GET(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as PluginType | null;
    const enabled = searchParams.get("enabled") === "true" ? true : searchParams.get("enabled") === "false" ? false : undefined;

    const plugins = await pluginSystem.listPlugins(tenantId, type || undefined, enabled);

    return NextResponse.json({
      plugins,
      count: plugins.length,
    });
  })(request);
}

/**
 * POST /api/plugins - Install plugin
 */
export async function POST(request: NextRequest) {
  return createApiHandler(async (req) => {
    const user = await requireAuth();
    const tenantId = (user as any).tenantId || "";

    const body = await req.json();
    const validated = installPluginSchema.parse(body);

    const plugin = await pluginSystem.installPlugin(tenantId, {
      name: validated.name,
      type: validated.type,
      version: validated.version,
      description: validated.description,
      config: validated.config,
      handler: validated.handler,
      enabled: validated.enabled ?? true,
      metadata: validated.metadata,
    });

    logger.info("Plugin installed", {
      pluginId: plugin.id,
      tenantId,
      name: plugin.name,
      type: plugin.type,
    });

    return NextResponse.json(plugin, { status: 201 });
  })(request);
}
