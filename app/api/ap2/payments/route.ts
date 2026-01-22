/**
 * AP2 Payment Execution API
 * Execute payments from approved mandates
 */

import { NextRequest, NextResponse } from "next/server";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const executePaymentSchema = z.object({
  mandateId: z.string(),
  fromAgentId: z.string(),
  toAgentId: z.string(),
  signature: z.string(),
  publicKey: z.string(),
  adapterName: z.string().optional(),
});

const revokeMandateSchema = z.object({
  mandateId: z.string(),
  agentId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || "execute";

    if (action === "execute") {
      const validated = executePaymentSchema.parse(body);
      const ap2Protocol = getAP2Protocol();

      const result = await ap2Protocol.executePaymentWithAdapter(
        {
          mandateId: validated.mandateId,
          fromAgentId: validated.fromAgentId,
          toAgentId: validated.toAgentId,
          signature: validated.signature,
          publicKey: validated.publicKey,
        },
        validated.adapterName
      );

      return NextResponse.json({
        success: true,
        ...result,
      });
    } else if (action === "revoke") {
      const validated = revokeMandateSchema.parse(body);
      const ap2Protocol = getAP2Protocol();
      await ap2Protocol.revokeMandate(validated.mandateId, validated.agentId);

      return NextResponse.json({
        success: true,
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("AP2 payment operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}
