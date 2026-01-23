/**
 * Payment Processor Integration API
 * 
 * GET /api/cases/[id]/payment/transaction - Fetch transaction details
 * GET /api/cases/[id]/payment/chargeback - Get chargeback details
 * POST /api/cases/[id]/payment/refund - Create refund
 */

import { NextRequest, NextResponse } from "next/server";
import { createApiHandler } from "@/lib/middleware/api-wrapper";
import { paymentProcessorAdapter } from "@/lib/cases/integrations/payment-adapter";
import { db } from "@/lib/db/client";
import { z } from "zod";
import { logger } from "@/lib/logging/logger";

const refundSchema = z.object({
  processor: z.string().min(1),
  transactionId: z.string().min(1),
  amount: z.number().positive(),
  reason: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const url = new URL(request.url);
        const action = url.searchParams.get("action");
        const processor = url.searchParams.get("processor");
        const transactionId = url.searchParams.get("transactionId");
        const disputeId = url.searchParams.get("disputeId");

        if (!processor) {
          return NextResponse.json(
            { error: "Processor name required" },
            { status: 400 }
          );
        }

        if (action === "transaction" && transactionId) {
          const transaction = await paymentProcessorAdapter.fetchTransaction(processor, transactionId);
          if (!transaction) {
            return NextResponse.json(
              { error: "Transaction not found" },
              { status: 404 }
            );
          }
          return NextResponse.json({ transaction });
        }

        if (action === "chargeback" && disputeId) {
          const chargeback = await paymentProcessorAdapter.verifyChargeback(processor, disputeId);
          if (!chargeback) {
            return NextResponse.json(
              { error: "Chargeback not found" },
              { status: 404 }
            );
          }
          return NextResponse.json({ chargeback });
        }

        return NextResponse.json(
          { error: "Invalid action or missing parameters" },
          { status: 400 }
        );
      } catch (error) {
        logger.error("Failed to fetch payment data", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to fetch payment data", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 100,
      },
    }
  );
  return handler(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const handler = createApiHandler(
    async (request: NextRequest, context?: { user?: any; tenantId?: string }) => {
      try {
        const caseId = id;
        const tenantId = context?.tenantId;

        if (!tenantId) {
          return NextResponse.json(
            { error: "Tenant ID required" },
            { status: 400 }
          );
        }

        // Verify case belongs to tenant
        const case_ = await db.case.findFirst({
          where: { id: caseId, tenantId },
        });

        if (!case_) {
          return NextResponse.json(
            { error: "Case not found" },
            { status: 404 }
          );
        }

        const body = await request.json();
        const validated = refundSchema.parse(body);

        const result = await paymentProcessorAdapter.createRefund(
          validated.processor,
          validated.transactionId,
          validated.amount,
          validated.reason
        );

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || "Refund failed" },
            { status: 400 }
          );
        }

        // Update case metadata with refund info
        await db.case.update({
          where: { id: caseId },
          data: {
            metadata: {
              ...((case_.metadata as Record<string, unknown>) || {}),
              refund: {
                processor: validated.processor,
                transactionId: validated.transactionId,
                refundId: result.refundId,
                amount: validated.amount,
                reason: validated.reason,
                createdAt: new Date().toISOString(),
              },
            } as any,
          },
        });

        logger.info("Refund created", {
          case_id: caseId,
          processor: validated.processor,
          refund_id: result.refundId,
        });

        return NextResponse.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            { error: "Validation error", details: error.issues },
            { status: 400 }
          );
        }

        logger.error("Failed to create refund", {
          error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
          { error: "Failed to create refund", message: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 }
        );
      }
    },
    {
      requireAuth: true,
      rateLimit: {
        windowMs: 60 * 1000,
        maxRequests: 50,
      },
    }
  );
  return handler(request);
}
