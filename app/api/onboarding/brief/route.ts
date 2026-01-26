import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { ForecastService } from "@/lib/forecasts/service";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { financialServicesMode } from "@/lib/financial-services/operating-mode";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const onboardingBriefSchema = z.object({
  sku: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const { sku } = onboardingBriefSchema.parse(body);

    // Generate first perception brief
    const eventStore = new DatabaseEventStore();
    const beliefGraph = new DatabaseBeliefGraphService();
    const forecastService = new ForecastService(eventStore, beliefGraph as any);
    const evidenceVault = new DatabaseEvidenceVault();

    // Get evidence count
    const evidence = await evidenceVault.query({ tenant_id });
    const evidenceCount = evidence.length;

    // Get claim clusters
    const clusters = await db.claimCluster.findMany({
      where: { tenantId: tenant_id },
      orderBy: [{ decisiveness: "desc" }, { size: "desc" }],
      take: 10,
      include: {
        primaryClaim: true,
      },
    });

    // Generate basic forecast (use Hawkes if enabled)
    const forecast = await forecastService.forecastOutbreak(
      tenant_id,
      7, // 7 day horizon
      [], // Empty signals for baseline
      { use_hawkes: true }
    );

    // If SKU B (Financial Services), mark Day 1 as completed after brief generation
    if (sku === "B" || sku === "b") {
      try {
        const config = await financialServicesMode.getConfig(tenant_id);
        if (config.enabled && !config.day1Completed) {
          await financialServicesMode.completeDay1(tenant_id);
          logger.info("Financial Services Day 1 completed via onboarding brief", {
            tenant_id,
          });
        }
      } catch (fsError) {
        // If Financial Services mode not enabled, that's okay - continue
        logger.warn("Financial Services mode not enabled, skipping Day 1 completion", {
          tenant_id,
        });
      }
    }

    // Return brief
    const brief = {
      claim_clusters: clusters.map((c) => ({
        id: c.id,
        primary_claim: c.primaryClaim.canonicalText,
        size: c.size,
        decisiveness: c.decisiveness || 0,
      })),
      outbreak_probability: forecast.probability,
      evidence_count: evidenceCount,
      generated_at: new Date().toISOString(),
      sku,
    };

    logger.info("Onboarding: Brief generated", { tenant_id, sku, clusters: clusters.length });

    return NextResponse.json(brief);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    logger.error("Onboarding: Failed to generate brief", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Failed to generate brief" },
      { status: 500 }
    );
  }
}
