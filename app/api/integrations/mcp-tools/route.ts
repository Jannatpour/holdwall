/**
 * MCP Tools Registry API
 * Returns available MCP tools with real execution metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { InMemoryMCPToolRegistry } from "@/lib/mcp/registry";
import { MCPGateway } from "@/lib/mcp/gateway";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

const registry = new InMemoryMCPToolRegistry();
const gateway = new MCPGateway();

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const tools = registry.list();

    // Get execution metrics from audit log
    const auditEntries = await gateway.getAuditLog({
      tenantId: tenant_id,
    });

    // Calculate metrics per tool
    const toolMetrics = new Map<string, {
      lastRun?: string;
      successCount: number;
      failureCount: number;
      totalExecutions: number;
      avgExecutionTime: number;
    }>();

    for (const entry of auditEntries) {
      const existing = toolMetrics.get(entry.toolName) || {
        successCount: 0,
        failureCount: 0,
        totalExecutions: 0,
        avgExecutionTime: 0,
        executionTimes: [] as number[],
        lastRun: undefined as string | undefined,
      };

      existing.totalExecutions++;
      if (entry.success) {
        existing.successCount++;
      } else {
        existing.failureCount++;
      }

      if (!existing.lastRun || entry.timestamp > existing.lastRun) {
        existing.lastRun = entry.timestamp;
      }

      if (entry.executionTimeMs > 0) {
        (existing as any).executionTimes = (existing as any).executionTimes || [];
        (existing as any).executionTimes.push(entry.executionTimeMs);
      }

      toolMetrics.set(entry.toolName, existing);
    }

    return NextResponse.json({
      tools: tools.map((tool) => {
        const metrics = toolMetrics.get(tool.name) || {
          successCount: 0,
          failureCount: 0,
          totalExecutions: 0,
          avgExecutionTime: 0,
        };

        const executionTimes = (metrics as any).executionTimes || [];
        const avgExecutionTime =
          executionTimes.length > 0
            ? executionTimes.reduce((a: number, b: number) => a + b, 0) / executionTimes.length
            : 0;

        const reliabilityScore =
          metrics.totalExecutions > 0
            ? metrics.successCount / metrics.totalExecutions
            : 0.95; // Default for tools with no executions

        return {
          name: tool.name,
          version: tool.version,
          description: tool.description || "",
          permissions: ((tool as any).permissions as string[] | undefined) || [],
          lastRun: metrics.lastRun,
          rateLimit: ((tool as any).rateLimit as string | undefined) || "10/min",
          reliabilityScore: Math.round(reliabilityScore * 100) / 100,
          totalExecutions: metrics.totalExecutions,
          successRate: metrics.totalExecutions > 0
            ? Math.round((metrics.successCount / metrics.totalExecutions) * 100)
            : 100,
          avgExecutionTimeMs: Math.round(avgExecutionTime),
        };
      }),
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching MCP tools", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
