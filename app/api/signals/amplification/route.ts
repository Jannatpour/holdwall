/**
 * Signal Amplification API
 * Returns amplification metrics for signals over time based on real data
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { db } from "@/lib/db/client";
import { z } from "zod";

const amplificationRequestSchema = z.object({
  evidence_ids: z.array(z.string()),
  hours: z.number().int().min(1).max(168).optional().default(7), // Default 7 hours, max 7 days
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's tenantId from database
    const userId = (user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    const userRecord = await db.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const tenantId = userRecord.tenantId;

    const body = await request.json();
    const validated = amplificationRequestSchema.parse(body);

    const { evidence_ids, hours } = validated;
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Calculate amplification for each evidence ID based on:
    // 1. Related events over time
    // 2. Claims referencing the evidence
    // 3. Access logs
    // 4. Related signals/clusters
    const amplification: Record<string, number[]> = {};

    for (const evidenceId of evidence_ids) {
      // Verify evidence exists and belongs to user's tenant
      const evidence = await db.evidence.findFirst({
        where: {
          id: evidenceId,
          tenantId: tenantId,
        },
        select: {
          id: true,
          createdAt: true,
          contentMetadata: true,
        },
      });

      if (!evidence) {
        logger.warn("Evidence not found or access denied", {
          evidenceId,
          tenantId: tenantId,
        });
        amplification[evidenceId] = Array(hours).fill(0);
        continue;
      }

      // Get related events over time windows
      const timeWindows: number[] = [];
      for (let i = 0; i < hours; i++) {
        const windowStart = new Date(startTime.getTime() + i * 60 * 60 * 1000);
        const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000);

        // Count events referencing this evidence
        const eventCount = await db.eventEvidence.count({
          where: {
            evidenceId,
            event: {
              occurredAt: {
                gte: windowStart,
                lt: windowEnd,
              },
            },
          },
        });

        // Count claims created that reference this evidence
        const claimCount = await db.claimEvidence.count({
          where: {
            evidenceId,
            claim: {
              createdAt: {
                gte: windowStart,
                lt: windowEnd,
              },
            },
          },
        });

        // Count access logs
        const accessCount = await db.evidenceAccessLog.count({
          where: {
            evidenceId,
            createdAt: {
              gte: windowStart,
              lt: windowEnd,
            },
          },
        });

        // Get base amplification from metadata if available
        const baseAmplification =
          (evidence.contentMetadata as any)?.amplification ?? 0.5;

        // Calculate amplification score:
        // - Base amplification from metadata
        // - Event activity (weighted 0.4)
        // - Claim activity (weighted 0.4)
        // - Access activity (weighted 0.2)
        const eventWeight = Math.min(eventCount / 10, 1) * 0.4;
        const claimWeight = Math.min(claimCount / 5, 1) * 0.4;
        const accessWeight = Math.min(accessCount / 20, 1) * 0.2;

        const amplificationScore = Math.min(
          1,
          baseAmplification + eventWeight + claimWeight + accessWeight
        );

        timeWindows.push(amplificationScore);
      }

      amplification[evidenceId] = timeWindows;
    }

    return NextResponse.json({ amplification });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching signal amplification data", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
