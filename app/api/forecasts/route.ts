/**
 * Forecasts API Routes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { DatabaseEventStore } from "@/lib/events/store-db";
import { DatabaseBeliefGraphService } from "@/lib/graph/belief-implementation";
import { ForecastService, type DriftForecast, type OutbreakForecast } from "@/lib/forecasts/service";
import { broadcastForecastUpdate } from "@/lib/events/broadcast-helper";
import { validateBusinessRules } from "@/lib/validation/business-rules";
import { IdempotencyService, withIdempotency } from "@/lib/operations/idempotency";
import { ErrorRecoveryService } from "@/lib/operations/error-recovery";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const eventStore = new DatabaseEventStore();
const beliefGraph = new DatabaseBeliefGraphService();
const forecastService = new ForecastService(eventStore, beliefGraph as any);
const idempotencyService = new IdempotencyService();
const errorRecovery = new ErrorRecoveryService();

const forecastDriftSchema = z.object({
  metric: z.string(),
  horizon_days: z.number().positive(),
  baseline_data: z.array(z.number()),
});

const forecastOutbreakSchema = z.object({
  horizon_days: z.number().positive(),
  signals: z.array(
    z.object({
      amplification: z.number(),
      sentiment: z.number(),
    })
  ),
});

export async function GET(request: NextRequest) {
  let user: any = null;
  try {
    user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");

    // If requesting narrative forecasts, handle separately
    if (type === "narrative") {
      try {
        const narrativeForecasts = await db.forecast.findMany({
          where: {
            tenantId: tenant_id,
            type: "OUTBREAK",
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { value: "desc" },
          take: 20,
        });

        return NextResponse.json({
          forecasts: narrativeForecasts.map((f) => {
            const typeData = (f.typeData as any) || {};
            return {
              id: f.id,
              narrative: (typeData.narrative || typeData.narrative_type || "unknown") as string,
              surface: (typeData.surface || "all") as string,
              region: (typeData.region || "global") as string,
              probability: f.value ?? 0,
              horizon_days: f.horizonDays ?? 7,
              confidence: f.confidenceLevel ?? 0.5,
              createdAt: f.createdAt.toISOString(),
            };
          }),
        });
      } catch (narrativeError) {
        logger.error("Error fetching narrative forecasts", {
          error: narrativeError instanceof Error ? narrativeError.message : String(narrativeError),
          tenant_id,
        });
        // Return empty array instead of failing completely
        return NextResponse.json({
          forecasts: [],
        });
      }
    }

    // Build where clause for standard forecast queries
    const where: any = { tenantId: tenant_id };
    if (type && type !== "narrative") {
      // Only set type filter if it's a valid ForecastType
      const validTypes = ["DRIFT", "ANOMALY", "OUTBREAK", "DIFFUSION"];
      const upperType = type.toUpperCase();
      if (validTypes.includes(upperType)) {
        where.type = upperType;
      }
    }

    const forecasts = await db.forecast.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // If requesting drift analysis, compute it
    if (type === "drift") {
      try {
        // Get recent sentiment data from signals
        const recentSignals = await db.evidence.findMany({
          where: {
            tenantId: tenant_id,
            type: "SIGNAL",
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          take: 100,
          orderBy: { createdAt: "desc" },
          select: {
            contentMetadata: true,
            createdAt: true,
          },
        });

        const sentiments = recentSignals
          .map((s) => {
            const meta = (s.contentMetadata || {}) as any;
            return typeof meta.sentiment === "number" ? meta.sentiment : 0.5;
          })
          .filter((s) => s > 0 && s < 1);

        if (sentiments.length > 0) {
          const currentSentiment = sentiments.slice(0, 10).reduce((sum, s) => sum + s, 0) / Math.min(10, sentiments.length);
          const historicalSentiment = sentiments.slice(10).reduce((sum, s) => sum + s, 0) / Math.max(1, sentiments.length - 10);
          const driftMagnitude = Math.abs(currentSentiment - historicalSentiment);
          const trend = currentSentiment > historicalSentiment ? "increasing" : currentSentiment < historicalSentiment ? "decreasing" : "stable";

          return NextResponse.json({
            forecasts,
            analysis: {
              currentSentiment,
              predictedSentiment: currentSentiment + (driftMagnitude * 0.1), // Simple prediction
              driftMagnitude,
              confidence: Math.min(0.9, 0.5 + (sentiments.length / 100)),
              trend,
            },
          });
        }
      } catch (driftError) {
        logger.error("Error computing drift analysis", {
          error: driftError instanceof Error ? driftError.message : String(driftError),
          tenant_id,
        });
        // Return forecasts without analysis if drift computation fails
      }
    }

    return NextResponse.json({ forecasts });
  } catch (error) {
    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Error fetching forecasts", {
      error: error instanceof Error ? error.message : String(error),
      tenant_id: (user as any)?.tenantId || "unknown",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let user: any = null;
  try {
    user = await requireAuth();
    const tenant_id = (user as any).tenantId || "";
    const body = await request.json();

    if (body.type === "drift") {
      const validated = forecastDriftSchema.parse(body);
      
      // Validate forecast parameters
      const validation = await validateBusinessRules("forecast", {
        horizon: validated.horizon_days,
        type: "DRIFT",
      }, tenant_id);

      if (!validation.valid) {
        return NextResponse.json(
          { error: "Validation failed", details: validation.errors },
          { status: 400 }
        );
      }

      // Execute with idempotency and error recovery
      const forecast: DriftForecast = await withIdempotency(
        idempotencyService,
        tenant_id,
        "forecast_drift",
        {
          metric: validated.metric,
          horizon_days: validated.horizon_days,
          baseline_data: validated.baseline_data,
        },
        async () => {
          const recoveryResult = await errorRecovery.executeWithRecovery(
            async () => {
              return await forecastService.forecastDrift(
                tenant_id,
                validated.metric,
                validated.horizon_days,
                validated.baseline_data
              );
            },
            {
              retry: {
                maxAttempts: 2,
                backoffMs: 2000,
                exponential: true,
              },
              timeout: 60_000, // 60 seconds for forecast generation
              circuitBreaker: errorRecovery.getCircuitBreaker("forecast_generation"),
            },
            "forecast_drift"
          );

          if (!recoveryResult.success) {
            throw recoveryResult.error || new Error("Forecast generation failed");
          }

          return recoveryResult.result as DriftForecast;
        }
      );
      
      // Save to database
      const savedForecast = await db.forecast.create({
        data: {
          tenantId: tenant_id,
          type: "DRIFT",
          targetMetric: forecast.target_metric,
          value: forecast.value,
          confidenceLower: forecast.confidence.lower,
          confidenceUpper: forecast.confidence.upper,
          confidenceLevel: forecast.confidence.level,
          horizonDays: forecast.horizon_days,
          model: forecast.model,
          evalScore: forecast.eval_score,
          typeData: {
            baseline: (forecast as any).baseline,
            direction: (forecast as any).direction,
            drift_rate: (forecast as any).drift_rate,
          },
        },
      });
      
      // Broadcast real-time update
      await broadcastForecastUpdate(savedForecast.id, "created", {
        type: "DRIFT",
        metric: validated.metric,
        value: forecast.value,
      }, tenant_id);
      
      return NextResponse.json({
        ...forecast,
        id: savedForecast.id,
        forecast_id: savedForecast.id,
      }, { status: 201 });
    }

    if (body.type === "outbreak") {
      const validated = forecastOutbreakSchema.parse(body);
      
      // Validate forecast parameters
      const validation = await validateBusinessRules("forecast", {
        horizon: validated.horizon_days,
        type: "OUTBREAK",
      }, tenant_id);

      if (!validation.valid) {
        return NextResponse.json(
          { error: "Validation failed", details: validation.errors },
          { status: 400 }
        );
      }

      // Execute with idempotency and error recovery
      const forecast: OutbreakForecast = await withIdempotency(
        idempotencyService,
        tenant_id,
        "forecast_outbreak",
        {
          horizon_days: validated.horizon_days,
          signals: validated.signals,
        },
        async () => {
          const recoveryResult = await errorRecovery.executeWithRecovery(
            async () => {
              return await forecastService.forecastOutbreak(
                tenant_id,
                validated.horizon_days,
                validated.signals
              );
            },
            {
              retry: {
                maxAttempts: 2,
                backoffMs: 2000,
                exponential: true,
              },
              timeout: 60_000, // 60 seconds for forecast generation
              circuitBreaker: errorRecovery.getCircuitBreaker("forecast_generation"),
            },
            "forecast_outbreak"
          );

          if (!recoveryResult.success) {
            throw recoveryResult.error || new Error("Forecast generation failed");
          }

          return recoveryResult.result as OutbreakForecast;
        }
      );
      
      // Save to database
      const savedForecast = await db.forecast.create({
        data: {
          tenantId: tenant_id,
          type: "OUTBREAK",
          targetMetric: forecast.target_metric,
          value: forecast.probability,
          confidenceLower: forecast.confidence.lower,
          confidenceUpper: forecast.confidence.upper,
          confidenceLevel: forecast.confidence.level,
          horizonDays: forecast.horizon_days,
          model: forecast.model,
          evalScore: forecast.eval_score,
          typeData: {
            probability: forecast.probability,
            triggers: (forecast as any).triggers || [],
          },
        },
      });
      
      // Broadcast real-time update
      await broadcastForecastUpdate(savedForecast.id, "created", {
        type: "OUTBREAK",
        probability: forecast.probability,
        horizonDays: validated.horizon_days,
      }, tenant_id);
      
      return NextResponse.json({
        ...forecast,
        id: savedForecast.id,
        forecast_id: savedForecast.id,
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: "Invalid forecast type" },
      { status: 400 }
    );
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
    logger.error("Error creating forecast", {
      error: error instanceof Error ? error.message : String(error),
      tenant_id: (user as any)?.tenantId || "unknown",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
