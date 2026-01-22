/**
 * Payment Confirmation API
 * Confirm payment after client-side processing
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { paymentGateway } from "@/lib/payment/gateway";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const confirmSchema = z.object({
  paymentId: z.string(),
  paymentMethodId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: any;
  try {
    await requireAuth();

    body = await request.json();
    const { paymentId, paymentMethodId } = confirmSchema.parse(body);

    const result = await paymentGateway.confirmPayment(paymentId, paymentMethodId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
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

    logger.error("Error confirming payment", {
      paymentId: body?.paymentId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
