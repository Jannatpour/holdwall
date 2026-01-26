/**
 * A/B Testing API
 * Create and manage A/B tests
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth/session";
import { abTesting } from "@/lib/ab-testing/framework";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createTestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  variants: z.array(z.object({
    id: z.string().optional(),
    content: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(2),
  platform: z.string(),
  minSampleSize: z.number().optional(),
  confidenceLevel: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    await requireRole("ADMIN"); // Only admins can create A/B tests

    const body = await request.json();
    const data = createTestSchema.parse(body);

    const test = abTesting.createTest(
      data.name,
      data.variants.map(v => ({
        id: v.id || crypto.randomUUID(),
        content: v.content,
        metadata: v.metadata,
      })),
      data.platform
    );

    return NextResponse.json({ 
      test: {
        id: test.id,
        name: test.name,
        description: test.description,
        variants: test.variants,
        platform: test.platform,
        startTime: test.startDate instanceof Date ? test.startDate.toISOString() : (typeof test.startDate === "string" ? test.startDate : new Date().toISOString()),
        endTime: test.endDate instanceof Date ? test.endDate.toISOString() : (typeof test.endDate === "string" ? test.endDate : undefined),
        status: test.status || (test.active ? "running" : "paused"),
      }
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("A/B test creation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const testId = request.nextUrl.searchParams.get("testId");

    if (testId) {
      const results = await abTesting.analyzeTest(testId);
      return NextResponse.json({ testId, results });
    }

    // List all tests (admin only)
    await requireRole("ADMIN");
    const tests = await abTesting.listTests();
    return NextResponse.json({ tests });
  } catch (error) {
    if ((error as Error).message === "Unauthorized" || (error as Error).message === "Forbidden") {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: (error as Error).message === "Unauthorized" ? 401 : 403 }
      );
    }

    logger.error("A/B test error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
