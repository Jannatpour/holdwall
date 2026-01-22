/**
 * AP2 Payment Mandates API
 * Create, approve, and manage payment mandates
 */

import { NextRequest, NextResponse } from "next/server";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const createMandateSchema = z.object({
  fromAgentId: z.string(),
  toAgentId: z.string(),
  type: z.enum(["intent", "cart", "payment"]),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  expiresIn: z.number().positive().optional(),
});

const approveMandateSchema = z.object({
  mandateId: z.string(),
  agentId: z.string(),
  signature: z.string(),
  publicKey: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || "create";

    if (action === "create") {
      const validated = createMandateSchema.parse(body);
      const ap2Protocol = getAP2Protocol();
      const mandate = await ap2Protocol.createMandate(validated);

      return NextResponse.json({
        success: true,
        mandate,
      });
    } else if (action === "approve") {
      const validated = approveMandateSchema.parse(body);
      const ap2Protocol = getAP2Protocol();
      const mandate = await ap2Protocol.approveMandate(validated);

      return NextResponse.json({
        success: true,
        mandate,
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

    logger.error("AP2 mandate operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const mandateId = searchParams.get("mandateId");

    const ap2Protocol = getAP2Protocol();

    // If mandateId is provided, return single mandate
    if (mandateId) {
      const mandate = await ap2Protocol.getMandate(mandateId);

      if (!mandate) {
        return NextResponse.json(
          { error: "Mandate not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({ mandate });
    }

    // Otherwise, list mandates with filters
    const fromAgentId = searchParams.get("fromAgentId") || undefined;
    const toAgentId = searchParams.get("toAgentId") || undefined;
    const statusParam = searchParams.get("status");
    const status = statusParam
      ? (statusParam.toLowerCase() as
          | "pending"
          | "approved"
          | "rejected"
          | "expired"
          | "revoked"
          | "completed")
      : undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 1000) // Clamp between 1 and 1000
      : undefined;

    const mandates = await ap2Protocol.listMandates({
      fromAgentId,
      toAgentId,
      status: status || undefined,
      limit,
    });

    return NextResponse.json({ mandates });
  } catch (error) {
    logger.error("AP2 mandate retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
