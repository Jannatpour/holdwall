/**
 * Case Processing Cron Job
 * 
 * POST /api/cases/cron/process - Process automated case tasks
 * 
 * This endpoint should be called by a cron job to:
 * - Process follow-ups
 * - Check SLA compliance
 * - Update case priorities
 * - Check escalation rules
 */

import { NextRequest, NextResponse } from "next/server";
import { caseFollowUpsService } from "@/lib/cases/follow-ups";
import { caseSLAService } from "@/lib/cases/sla";
import { casePrioritizationEngine } from "@/lib/cases/prioritization";
import { caseEscalationService } from "@/lib/cases/escalation";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if configured
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId") || undefined;
    const task = url.searchParams.get("task") || "all";

    const results: Record<string, unknown> = {};

    // Process follow-ups
    if (task === "all" || task === "followups") {
      const followUpsSent = await caseFollowUpsService.processFollowUps(tenantId);
      results.followUpsSent = followUpsSent;
    }

    // Check SLA compliance
    if (task === "all" || task === "sla") {
      const slaCompliance = await caseSLAService.checkSLACompliance(tenantId);
      results.slaCompliance = slaCompliance;
    }

    // Update priorities
    if (task === "all" || task === "priorities") {
      if (tenantId) {
        const updated = await casePrioritizationEngine.batchUpdatePriorities(tenantId);
        results.prioritiesUpdated = updated;
      } else {
        // Update for all tenants
        const tenants = await db.tenant.findMany({
          select: { id: true },
        });
        let totalUpdated = 0;
        for (const tenant of tenants) {
          const updated = await casePrioritizationEngine.batchUpdatePriorities(tenant.id);
          totalUpdated += updated;
        }
        results.prioritiesUpdated = totalUpdated;
      }
    }

    // Check escalation rules
    if (task === "all" || task === "escalations") {
      const where: any = {
        status: { in: ["SUBMITTED", "TRIAGED", "IN_PROGRESS"] },
      };
      if (tenantId) {
        where.tenantId = tenantId;
      }

      const cases = await db.case.findMany({
        where,
        take: 100, // Process in batches
      });

      let escalationsTriggered = 0;
      for (const case_ of cases) {
        try {
          const escalations = await caseEscalationService.checkEscalationRules(case_);
          escalationsTriggered += escalations.length;
        } catch (error) {
          logger.error("Failed to check escalation rules", {
            case_id: case_.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      results.escalationsTriggered = escalationsTriggered;
    }

    logger.info("Case processing cron job completed", {
      tenant_id: tenantId || "all",
      task,
      results,
    });

    return NextResponse.json({
      success: true,
      task,
      tenantId: tenantId || "all",
      results,
    });
  } catch (error) {
    logger.error("Failed to process case cron job", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Failed to process case cron job", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
