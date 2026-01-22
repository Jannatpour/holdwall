/**
 * Belief Graph Calibration API
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { CalibrationEngine } from "@/lib/graph/calibration";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const fitSchema = z.object({
  model_id: z.string(),
  data: z.array(z.object({
    raw_score: z.number(),
    true_label: z.number(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })),
  type: z.enum(["platt", "isotonic"]).optional(),
});

const calibrateSchema = z.object({
  model_id: z.string(),
  raw_score: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const body = await request.json();
    const action = body.action;

    const engine = new CalibrationEngine();

    if (action === "fit") {
      const validated = fitSchema.parse(body);
      const model = engine.fit(
        validated.model_id,
        validated.data,
        validated.type || "platt"
      );

      return NextResponse.json({
        model_id: validated.model_id,
        model,
      });
    }

    if (action === "calibrate") {
      const validated = calibrateSchema.parse(body);
      const result = engine.calibrate(validated.model_id, validated.raw_score);

      return NextResponse.json(result);
    }

    if (action === "metrics") {
      const modelId = body.model_id;
      if (!modelId) {
        return NextResponse.json(
          { error: "model_id is required" },
          { status: 400 }
        );
      }

      const metrics = engine.getModelMetrics(modelId);
      return NextResponse.json({ metrics });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'fit', 'calibrate', or 'metrics'" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Calibration API error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
