/**
 * Intervention Simulation API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { InterventionSimulator } from "@/lib/forecasts/intervention-sim";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const simulateSchema = z.object({
  signals: z.array(z.object({
    amplification: z.number(),
    sentiment: z.number(),
    timestamp: z.number().optional(),
  })),
  intervention: z.object({
    id: z.string(),
    type: z.enum(["artifact_publication", "response", "correction", "transparency"]),
    time: z.number(),
    magnitude: z.number(),
    duration: z.number(),
    cost_usd: z.number().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  horizon_hours: z.number().optional(),
  value_per_event: z.number().optional(),
  include_roi: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const validated = simulateSchema.parse(body);

    const simulator = new InterventionSimulator();

    // Convert signals to Hawkes events
    const events = validated.signals
      .filter((s) => s.timestamp)
      .map((s) => ({
        timestamp: s.timestamp!,
        type: "signal",
        magnitude: s.amplification * (1 - s.sentiment),
        metadata: { sentiment: s.sentiment },
      }));

    const result = await simulator.simulate(
      events,
      {
        id: validated.intervention.id,
        type: validated.intervention.type,
        time: validated.intervention.time,
        magnitude: validated.intervention.magnitude,
        duration: validated.intervention.duration,
        cost_usd: validated.intervention.cost_usd,
        metadata: validated.intervention.metadata,
      },
      {
        horizon_hours: validated.horizon_hours,
        value_per_event: validated.value_per_event,
        include_roi: validated.include_roi,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Intervention simulation error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
