/**
 * Payment Processor Adapter
 * 
 * Abstract interface for multiple payment processors (Stripe, Adyen, PayPal, etc.)
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

// Note: logger is used in initializePaymentProcessors

export interface PaymentProcessor {
  name: string;
  fetchTransaction(transactionId: string): Promise<TransactionDetails | null>;
  verifyChargeback(disputeId: string): Promise<ChargebackDetails | null>;
  createRefund(transactionId: string, amount: number, reason: string): Promise<RefundResult>;
  getTransactionMetadata(transactionId: string): Promise<Record<string, unknown>>;
}

export interface TransactionDetails {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded" | "disputed";
  merchant: string;
  customer: {
    email?: string;
    name?: string;
  };
  createdAt: Date;
  metadata: Record<string, unknown>;
}

export interface ChargebackDetails {
  id: string;
  transactionId: string;
  amount: number;
  currency: string;
  reason: string;
  status: "pending" | "won" | "lost" | "withdrawn";
  deadline: Date;
  evidenceRequired: string[];
  winProbability?: number;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount: number;
  error?: string;
}

/**
 * Payment Processor Adapter
 * 
 * Provides unified interface for multiple payment processors
 */
export class PaymentProcessorAdapter {
  private processors: Map<string, PaymentProcessor> = new Map();

  /**
   * Register payment processor
   */
  register(processor: PaymentProcessor): void {
    this.processors.set(processor.name.toLowerCase(), processor);
    logger.info("Payment processor registered", {
      name: processor.name,
    });
  }

  /**
   * Get processor by name (async, ensures initialization)
   */
  async getProcessor(name: string): Promise<PaymentProcessor | null> {
    // Ensure processors are initialized
    if (!processorsRegistered) {
      await initializePaymentProcessors();
    }
    return this.processors.get(name.toLowerCase()) || null;
  }

  /**
   * Fetch transaction from any processor
   */
  async fetchTransaction(
    processorName: string,
    transactionId: string
  ): Promise<TransactionDetails | null> {
    const processor = await this.getProcessor(processorName);
    if (!processor) {
      throw new Error(`Payment processor not found: ${processorName}`);
    }

    try {
      const transaction = await processor.fetchTransaction(transactionId);
      metrics.increment("payment_transactions_fetched_total", {
        processor: processorName,
      });
      return transaction;
    } catch (error) {
      metrics.increment("payment_transactions_errors_total", {
        processor: processorName,
      });
      logger.error("Failed to fetch transaction", {
        processor: processorName,
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Verify chargeback from any processor
   */
  async verifyChargeback(
    processorName: string,
    disputeId: string
  ): Promise<ChargebackDetails | null> {
    const processor = await this.getProcessor(processorName);
    if (!processor) {
      throw new Error(`Payment processor not found: ${processorName}`);
    }

    try {
      const chargeback = await processor.verifyChargeback(disputeId);
      metrics.increment("chargebacks_verified_total", {
        processor: processorName,
      });
      return chargeback;
    } catch (error) {
      metrics.increment("chargebacks_errors_total", {
        processor: processorName,
      });
      logger.error("Failed to verify chargeback", {
        processor: processorName,
        dispute_id: disputeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create refund via any processor
   */
  async createRefund(
    processorName: string,
    transactionId: string,
    amount: number,
    reason: string
  ): Promise<RefundResult> {
    const processor = await this.getProcessor(processorName);
    if (!processor) {
      throw new Error(`Payment processor not found: ${processorName}`);
    }

    try {
      const result = await processor.createRefund(transactionId, amount, reason);
      metrics.increment("refunds_created_total", {
        processor: processorName,
        success: result.success.toString(),
      });
      return result;
    } catch (error) {
      metrics.increment("refunds_errors_total", {
        processor: processorName,
      });
      logger.error("Failed to create refund", {
        processor: processorName,
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get transaction metadata from any processor
   */
  async getTransactionMetadata(
    processorName: string,
    transactionId: string
  ): Promise<Record<string, unknown>> {
    const processor = await this.getProcessor(processorName);
    if (!processor) {
      throw new Error(`Payment processor not found: ${processorName}`);
    }

    try {
      const metadata = await processor.getTransactionMetadata(transactionId);
      return metadata;
    } catch (error) {
      logger.error("Failed to get transaction metadata", {
        processor: processorName,
        transaction_id: transactionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {};
    }
  }
}

export const paymentProcessorAdapter = new PaymentProcessorAdapter();

// Register default processors (lazy initialization)
let processorsRegistered = false;

export async function initializePaymentProcessors(): Promise<void> {
  if (processorsRegistered) {
    return;
  }

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const { StripeProcessor } = await import("./stripe");
      paymentProcessorAdapter.register(new StripeProcessor());
    } catch (error) {
      logger.warn("Failed to register Stripe processor", { error });
    }
  }

  if (process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT) {
    try {
      const { AdyenProcessor } = await import("./adyen");
      paymentProcessorAdapter.register(new AdyenProcessor());
    } catch (error) {
      logger.warn("Failed to register Adyen processor", { error });
    }
  }

  processorsRegistered = true;
}

// Processors will be initialized on first use via getProcessor method
