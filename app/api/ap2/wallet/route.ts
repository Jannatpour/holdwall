/**
 * AP2 Wallet API
 * Get wallet balance and ledger
 */

import { NextRequest, NextResponse } from "next/server";
import { getAP2Protocol } from "@/lib/payment/ap2";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const setLimitSchema = z.object({
  agentId: z.string(),
  limitType: z.enum(["daily", "weekly", "monthly", "transaction", "lifetime"]),
  limitAmount: z.number().positive(),
  currency: z.string().min(3).max(3),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const agentId = searchParams.get("agentId");
    const currency = searchParams.get("currency") || "usd";

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId parameter required" },
        { status: 400 }
      );
    }

    const ap2Protocol = getAP2Protocol();
    const walletId = `wallet_${agentId}`;
    const balance = await ap2Protocol.getWalletBalance(walletId, currency);
    const ledger = await ap2Protocol.getWalletLedger(walletId, currency);

    return NextResponse.json({
      agentId,
      currency,
      balance,
      ledger,
    });
  } catch (error) {
    logger.error("AP2 wallet retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || "set_limit";

    if (action === "set_limit") {
      const validated = setLimitSchema.parse(body);
      const ap2Protocol = getAP2Protocol();
      await ap2Protocol.setWalletLimit(
        validated.agentId,
        validated.limitType,
        validated.limitAmount,
        validated.currency
      );

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

    logger.error("AP2 wallet operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}
