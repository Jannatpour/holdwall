/**
 * Stripe Payment Processor Integration
 */

import { logger } from "@/lib/logging/logger";
import type {
  PaymentProcessor,
  TransactionDetails,
  ChargebackDetails,
  RefundResult,
} from "./payment-adapter";

export class StripeProcessor implements PaymentProcessor {
  name = "Stripe";
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.STRIPE_SECRET_KEY || "";
    if (!this.apiKey) {
      logger.warn("Stripe API key not configured");
    }
  }

  /**
   * Fetch transaction from Stripe
   */
  async fetchTransaction(transactionId: string): Promise<TransactionDetails | null> {
    if (!this.apiKey) {
      throw new Error("Stripe API key not configured");
    }

    try {
      const Stripe = (await import("stripe")).default;
      const client = new Stripe(this.apiKey, {
        // Use the latest available for the installed SDK; Stripe will enforce supported values.
        apiVersion: "2024-06-20" as any,
      });

      const charge = await client.charges.retrieve(transactionId);

      return {
        id: charge.id,
        amount: charge.amount / 100, // Convert from cents
        currency: charge.currency,
        status: this.mapStripeStatus(charge.status),
        merchant: charge.description || "Unknown",
        customer: {
          email: charge.billing_details?.email ?? undefined,
          name: charge.billing_details?.name ?? undefined,
        },
        createdAt: new Date(charge.created * 1000),
        metadata: charge.metadata || {},
      };
    } catch (error) {
      logger.error("Failed to fetch Stripe transaction", {
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Verify chargeback from Stripe
   */
  async verifyChargeback(disputeId: string): Promise<ChargebackDetails | null> {
    if (!this.apiKey) {
      throw new Error("Stripe API key not configured");
    }

    try {
      const Stripe = (await import("stripe")).default;
      const client = new Stripe(this.apiKey, { apiVersion: "2024-06-20" as any });

      const dispute = await client.disputes.retrieve(disputeId);

      return {
        id: dispute.id,
        transactionId: dispute.charge as string,
        amount: dispute.amount / 100, // Convert from cents
        currency: dispute.currency,
        reason: dispute.reason || "Unknown",
        status: this.mapStripeDisputeStatus(dispute.status),
        deadline: new Date(dispute.evidence_details?.due_by ? dispute.evidence_details.due_by * 1000 : Date.now() + 7 * 24 * 60 * 60 * 1000),
        evidenceRequired: this.getStripeEvidenceRequirements(dispute.reason),
        winProbability: this.calculateWinProbability(dispute),
      };
    } catch (error) {
      logger.error("Failed to verify Stripe chargeback", {
        dispute_id: disputeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Create refund via Stripe
   */
  async createRefund(transactionId: string, amount: number, reason: string): Promise<RefundResult> {
    if (!this.apiKey) {
      throw new Error("Stripe API key not configured");
    }

    try {
      const Stripe = (await import("stripe")).default;
      const client = new Stripe(this.apiKey, { apiVersion: "2024-06-20" as any });

      const refund = await client.refunds.create({
        charge: transactionId,
        amount: Math.round(amount * 100), // Convert to cents
        reason: reason === "fraudulent" ? "fraudulent" : "requested_by_customer",
      });

      return {
        success: refund.status === "succeeded",
        refundId: refund.id,
        amount: refund.amount / 100,
      };
    } catch (error) {
      logger.error("Failed to create Stripe refund", {
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        amount,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transaction metadata from Stripe
   */
  async getTransactionMetadata(transactionId: string): Promise<Record<string, unknown>> {
    if (!this.apiKey) {
      return {};
    }

    try {
      const Stripe = (await import("stripe")).default;
      const client = new Stripe(this.apiKey, { apiVersion: "2024-06-20" as any });

      const charge = await client.charges.retrieve(transactionId);

      return {
        ...charge.metadata,
        payment_method: charge.payment_method,
        payment_method_details: charge.payment_method_details,
        receipt_url: charge.receipt_url,
        receipt_email: charge.receipt_email,
        outcome: charge.outcome,
      };
    } catch (error) {
      logger.error("Failed to get Stripe transaction metadata", {
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }

  /**
   * Map Stripe charge status to our status
   */
  private mapStripeStatus(status: string): TransactionDetails["status"] {
    const mapping: Record<string, TransactionDetails["status"]> = {
      pending: "pending",
      succeeded: "completed",
      failed: "failed",
      refunded: "refunded",
    };
    return mapping[status] || "pending";
  }

  /**
   * Map Stripe dispute status
   */
  private mapStripeDisputeStatus(status: string): ChargebackDetails["status"] {
    const mapping: Record<string, ChargebackDetails["status"]> = {
      warning_needs_response: "pending",
      warning_under_review: "pending",
      warning_closed: "withdrawn",
      needs_response: "pending",
      under_review: "pending",
      charge_refunded: "won",
      won: "won",
      lost: "lost",
    };
    return mapping[status] || "pending";
  }

  /**
   * Get evidence requirements for Stripe dispute reason
   */
  private getStripeEvidenceRequirements(reason: string | null): string[] {
    const requirements: Record<string, string[]> = {
      fraudulent: [
        "Proof of customer authorization",
        "Proof of delivery",
        "Customer communication",
      ],
      subscription_canceled: [
        "Proof of service delivery",
        "Cancellation policy",
        "Customer communication",
      ],
      product_unacceptable: [
        "Product description",
        "Customer communication",
        "Refund policy",
      ],
      credit_not_processed: [
        "Proof of refund",
        "Refund policy",
        "Customer communication",
      ],
      general: [
        "Proof of service",
        "Customer communication",
        "Terms and conditions",
      ],
    };

    return requirements[reason || "general"] || requirements.general;
  }

  /**
   * Calculate win probability based on dispute details
   */
  private calculateWinProbability(dispute: any): number {
    // Simple heuristic based on dispute reason and evidence
    let probability = 0.5; // Base probability

    // Adjust based on reason
    if (dispute.reason === "fraudulent") {
      probability = 0.3; // Lower win rate for fraud
    } else if (dispute.reason === "subscription_canceled") {
      probability = 0.6; // Higher win rate for subscription issues
    }

    // Adjust based on evidence submission
    if (dispute.evidence_details?.submission_count > 0) {
      probability += 0.1;
    }

    return Math.max(0, Math.min(1, probability));
  }
}
