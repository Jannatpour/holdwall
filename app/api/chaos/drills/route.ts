/**
 * Chaos Engineering Drills API
 * 
 * Execute chaos drills that map to operational runbooks
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { ChaosDrillsService } from "@/lib/chaos/drills";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const runDrillSchema = z.object({
  drill_type: z.enum(["db_outage", "redis_outage", "provider_outage", "rate_limit_abuse", "all"]),
  duration_seconds: z.number().optional(),
  enable_actual_outage: z.boolean().optional().default(false), // Safety: default to false
});

const service = new ChaosDrillsService();

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN"); // Only admins can run chaos drills
    const tenantId = (user as any).tenantId || "";

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant ID required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = runDrillSchema.parse(body);

    let results;

    if (validated.drill_type === "all") {
      results = await service.runAllDrills({
        tenantId,
        duration_seconds: validated.duration_seconds,
        enable_actual_outage: validated.enable_actual_outage,
      });
    } else {
      const drillMethod = {
        db_outage: "runDBOutageDrill",
        redis_outage: "runRedisOutageDrill",
        provider_outage: "runProviderOutageDrill",
        rate_limit_abuse: "runRateLimitAbuseDrill",
      }[validated.drill_type];

      if (!drillMethod) {
        return NextResponse.json(
          { error: "Invalid drill type" },
          { status: 400 }
        );
      }

      const result = await (service as any)[drillMethod]({
        tenantId,
        drillType: validated.drill_type,
        duration_seconds: validated.duration_seconds,
        enable_actual_outage: validated.enable_actual_outage,
      });

      results = [result];
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.status === "passed").length,
        failed: results.filter((r) => r.status === "failed").length,
        partial: results.filter((r) => r.status === "partial").length,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Failed to run chaos drill", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole("ADMIN");
    
    return NextResponse.json({
      description: "Execute chaos engineering drills that map to operational runbooks",
      usage: {
        method: "POST",
        endpoint: "/api/chaos/drills",
        body: {
          drill_type: "db_outage | redis_outage | provider_outage | rate_limit_abuse | all",
          duration_seconds: "optional - how long to simulate outage",
          enable_actual_outage: "optional - if true, actually simulate outage (default: false)",
        },
      },
      available_drills: {
        db_outage: {
          name: "Database Outage Drill (SC-REL-001)",
          description: "Test degraded mode behavior when database is unavailable",
          runbook: "docs/scenario-playbooks.md#sc-rel-001-database-outage",
        },
        redis_outage: {
          name: "Redis Outage Drill (SC-REL-002)",
          description: "Test in-memory cache fallback when Redis is unavailable",
          runbook: "docs/scenario-playbooks.md#sc-rel-002-redis-cache-outage",
        },
        provider_outage: {
          name: "Provider Outage Drill (SC-AI-002)",
          description: "Test AI provider fallback and circuit breaker behavior",
          runbook: "docs/scenario-playbooks.md#sc-ai-002-model-provider-outage",
        },
        rate_limit_abuse: {
          name: "Rate Limit Abuse Drill",
          description: "Test rate limiting enforcement and audit logging",
          runbook: "docs/scenario-playbooks.md#rate-limiting",
        },
      },
      safety_note: "By default, drills simulate outages without actually causing them. Set enable_actual_outage=true only in staging/test environments.",
    });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
