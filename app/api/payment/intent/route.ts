/**
 * Payment Intent API
 * Create payment intents for subscriptions and one-time payments
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { paymentGateway } from "@/lib/payment/gateway";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const paymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default("usd"),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  customerId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const intent = paymentIntentSchema.parse(body);

    const result = await paymentGateway.createPaymentIntent(intent);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paymentId: result.paymentId,
      clientSecret: result.clientSecret,
      requiresAction: result.requiresAction,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    if ((error as Error).message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.error("Payment intent creation error", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
