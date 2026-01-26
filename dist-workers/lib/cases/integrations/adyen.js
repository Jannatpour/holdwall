"use strict";
/**
 * Adyen Payment Processor Integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdyenProcessor = void 0;
const logger_1 = require("@/lib/logging/logger");
class AdyenProcessor {
    constructor() {
        this.name = "Adyen";
        this.apiKey = process.env.ADYEN_API_KEY || "";
        this.merchantAccount = process.env.ADYEN_MERCHANT_ACCOUNT || "";
        if (!this.apiKey || !this.merchantAccount) {
            logger_1.logger.warn("Adyen credentials not fully configured");
        }
    }
    /**
     * Fetch transaction from Adyen
     */
    async fetchTransaction(transactionId) {
        if (!this.apiKey || !this.merchantAccount) {
            throw new Error("Adyen credentials not configured");
        }
        try {
            const response = await fetch(`https://pal-test.adyen.com/pal/servlet/Payment/v68/payments/${transactionId}`, {
                method: "GET",
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`Adyen API error: ${response.status}`);
            }
            const payment = await response.json();
            return {
                id: payment.pspReference || transactionId,
                amount: payment.amount?.value ? payment.amount.value / 100 : 0,
                currency: payment.amount?.currency || "USD",
                status: this.mapAdyenStatus(payment.resultCode),
                merchant: this.merchantAccount,
                customer: {
                    email: payment.additionalData?.shopperEmail,
                    name: payment.additionalData?.shopperName,
                },
                createdAt: new Date(payment.creationDate || Date.now()),
                metadata: payment.additionalData || {},
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch Adyen transaction", {
                transaction_id: transactionId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    /**
     * Verify chargeback from Adyen
     */
    async verifyChargeback(disputeId) {
        if (!this.apiKey || !this.merchantAccount) {
            throw new Error("Adyen credentials not configured");
        }
        try {
            // Adyen uses different endpoints for disputes
            const response = await fetch(`https://pal-test.adyen.com/pal/servlet/DisputeService/v12/retrieveDispute`, {
                method: "POST",
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    merchantAccount: this.merchantAccount,
                    disputeReference: disputeId,
                }),
            });
            if (!response.ok) {
                throw new Error(`Adyen API error: ${response.status}`);
            }
            const dispute = await response.json();
            return {
                id: dispute.disputeReference || disputeId,
                transactionId: dispute.originalPspReference || "",
                amount: dispute.disputeAmount?.value ? dispute.disputeAmount.value / 100 : 0,
                currency: dispute.disputeAmount?.currency || "USD",
                reason: dispute.reason || "Unknown",
                status: this.mapAdyenDisputeStatus(dispute.status),
                deadline: new Date(dispute.deadline || Date.now() + 7 * 24 * 60 * 60 * 1000),
                evidenceRequired: this.getAdyenEvidenceRequirements(dispute.reason),
                winProbability: this.calculateWinProbability(dispute),
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to verify Adyen chargeback", {
                dispute_id: disputeId,
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    /**
     * Create refund via Adyen
     */
    async createRefund(transactionId, amount, reason) {
        if (!this.apiKey || !this.merchantAccount) {
            throw new Error("Adyen credentials not configured");
        }
        try {
            const response = await fetch(`https://pal-test.adyen.com/pal/servlet/Payment/v68/refund`, {
                method: "POST",
                headers: {
                    "X-API-Key": this.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    merchantAccount: this.merchantAccount,
                    originalReference: transactionId,
                    amount: {
                        value: Math.round(amount * 100), // Convert to minor units
                        currency: "USD",
                    },
                    reference: `refund-${Date.now()}`,
                }),
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Adyen API error: ${response.status}`);
            }
            const refund = await response.json();
            return {
                success: refund.resultCode === "Received" || refund.resultCode === "Success",
                refundId: refund.pspReference,
                amount,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to create Adyen refund", {
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
     * Get transaction metadata from Adyen
     */
    async getTransactionMetadata(transactionId) {
        if (!this.apiKey || !this.merchantAccount) {
            return {};
        }
        try {
            const payment = await this.fetchTransaction(transactionId);
            if (!payment) {
                return {};
            }
            return {
                ...payment.metadata,
                processor: "adyen",
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to get Adyen transaction metadata", {
                transaction_id: transactionId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {};
        }
    }
    /**
     * Map Adyen payment result code to our status
     */
    mapAdyenStatus(resultCode) {
        const mapping = {
            Authorised: "completed",
            Received: "pending",
            Refused: "failed",
            Error: "failed",
            Cancelled: "failed",
            RedirectShopper: "pending",
            IdentifyShopper: "pending",
            ChallengeShopper: "pending",
        };
        return mapping[resultCode] || "pending";
    }
    /**
     * Map Adyen dispute status
     */
    mapAdyenDisputeStatus(status) {
        const mapping = {
            Open: "pending",
            Won: "won",
            Lost: "lost",
            Closed: "withdrawn",
        };
        return mapping[status] || "pending";
    }
    /**
     * Get evidence requirements for Adyen dispute reason
     */
    getAdyenEvidenceRequirements(reason) {
        // Similar to Stripe requirements
        const requirements = {
            Fraud: [
                "Proof of customer authorization",
                "Proof of delivery",
                "Customer communication",
            ],
            Authorization: [
                "Proof of service delivery",
                "Customer communication",
            ],
            ProcessingError: [
                "Transaction details",
                "Customer communication",
            ],
            ConsumerDispute: [
                "Product description",
                "Customer communication",
                "Refund policy",
            ],
        };
        return requirements[reason || "ConsumerDispute"] || requirements.ConsumerDispute;
    }
    /**
     * Calculate win probability based on dispute details
     */
    calculateWinProbability(dispute) {
        let probability = 0.5; // Base probability
        if (dispute.reason === "Fraud") {
            probability = 0.3;
        }
        else if (dispute.reason === "ProcessingError") {
            probability = 0.7;
        }
        return Math.max(0, Math.min(1, probability));
    }
}
exports.AdyenProcessor = AdyenProcessor;
