"use strict";
/**
 * Payment Processor Adapter
 *
 * Abstract interface for multiple payment processors (Stripe, Adyen, PayPal, etc.)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentProcessorAdapter = exports.PaymentProcessorAdapter = void 0;
exports.initializePaymentProcessors = initializePaymentProcessors;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
/**
 * Payment Processor Adapter
 *
 * Provides unified interface for multiple payment processors
 */
class PaymentProcessorAdapter {
    constructor() {
        this.processors = new Map();
    }
    /**
     * Register payment processor
     */
    register(processor) {
        this.processors.set(processor.name.toLowerCase(), processor);
        logger_1.logger.info("Payment processor registered", {
            name: processor.name,
        });
    }
    /**
     * Get processor by name (async, ensures initialization)
     */
    async getProcessor(name) {
        // Ensure processors are initialized
        if (!processorsRegistered) {
            await initializePaymentProcessors();
        }
        return this.processors.get(name.toLowerCase()) || null;
    }
    /**
     * Fetch transaction from any processor
     */
    async fetchTransaction(processorName, transactionId) {
        const processor = await this.getProcessor(processorName);
        if (!processor) {
            throw new Error(`Payment processor not found: ${processorName}`);
        }
        try {
            const transaction = await processor.fetchTransaction(transactionId);
            metrics_1.metrics.increment("payment_transactions_fetched_total", {
                processor: processorName,
            });
            return transaction;
        }
        catch (error) {
            metrics_1.metrics.increment("payment_transactions_errors_total", {
                processor: processorName,
            });
            logger_1.logger.error("Failed to fetch transaction", {
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
    async verifyChargeback(processorName, disputeId) {
        const processor = await this.getProcessor(processorName);
        if (!processor) {
            throw new Error(`Payment processor not found: ${processorName}`);
        }
        try {
            const chargeback = await processor.verifyChargeback(disputeId);
            metrics_1.metrics.increment("chargebacks_verified_total", {
                processor: processorName,
            });
            return chargeback;
        }
        catch (error) {
            metrics_1.metrics.increment("chargebacks_errors_total", {
                processor: processorName,
            });
            logger_1.logger.error("Failed to verify chargeback", {
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
    async createRefund(processorName, transactionId, amount, reason) {
        const processor = await this.getProcessor(processorName);
        if (!processor) {
            throw new Error(`Payment processor not found: ${processorName}`);
        }
        try {
            const result = await processor.createRefund(transactionId, amount, reason);
            metrics_1.metrics.increment("refunds_created_total", {
                processor: processorName,
                success: result.success.toString(),
            });
            return result;
        }
        catch (error) {
            metrics_1.metrics.increment("refunds_errors_total", {
                processor: processorName,
            });
            logger_1.logger.error("Failed to create refund", {
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
    async getTransactionMetadata(processorName, transactionId) {
        const processor = await this.getProcessor(processorName);
        if (!processor) {
            throw new Error(`Payment processor not found: ${processorName}`);
        }
        try {
            const metadata = await processor.getTransactionMetadata(transactionId);
            return metadata;
        }
        catch (error) {
            logger_1.logger.error("Failed to get transaction metadata", {
                processor: processorName,
                transaction_id: transactionId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {};
        }
    }
}
exports.PaymentProcessorAdapter = PaymentProcessorAdapter;
exports.paymentProcessorAdapter = new PaymentProcessorAdapter();
// Register default processors (lazy initialization)
let processorsRegistered = false;
async function initializePaymentProcessors() {
    if (processorsRegistered) {
        return;
    }
    if (process.env.STRIPE_SECRET_KEY) {
        try {
            const { StripeProcessor } = await Promise.resolve().then(() => __importStar(require("./stripe")));
            exports.paymentProcessorAdapter.register(new StripeProcessor());
        }
        catch (error) {
            logger_1.logger.warn("Failed to register Stripe processor", { error });
        }
    }
    if (process.env.ADYEN_API_KEY && process.env.ADYEN_MERCHANT_ACCOUNT) {
        try {
            const { AdyenProcessor } = await Promise.resolve().then(() => __importStar(require("./adyen")));
            exports.paymentProcessorAdapter.register(new AdyenProcessor());
        }
        catch (error) {
            logger_1.logger.warn("Failed to register Adyen processor", { error });
        }
    }
    processorsRegistered = true;
}
// Processors will be initialized on first use via getProcessor method
