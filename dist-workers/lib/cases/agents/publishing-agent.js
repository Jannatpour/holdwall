"use strict";
/**
 * Publishing Agent
 *
 * Autonomous artifact publishing agent.
 * Part of the 8-agent autonomous architecture.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishingAgent = exports.PublishingAgent = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
/**
 * Publishing Agent
 *
 * Autonomous artifact publishing
 */
class PublishingAgent {
    /**
     * Determine publishing strategy
     */
    async determinePublishingStrategy(case_, resolution) {
        // Calculate publishing confidence
        const confidence = this.calculatePublishingConfidence(case_, resolution);
        // Identify risk factors
        const riskFactors = this.identifyRiskFactors(case_, resolution);
        // Determine if safe to publish
        const shouldPublish = confidence > 0.8 && riskFactors.length === 0;
        const publishImmediately = confidence > 0.9 && riskFactors.length === 0;
        const requiresApproval = confidence < 0.8 || riskFactors.length > 0;
        return {
            shouldPublish,
            publishImmediately,
            requiresApproval,
            confidence,
            riskFactors,
        };
    }
    /**
     * Calculate publishing confidence
     */
    calculatePublishingConfidence(case_, resolution) {
        let confidence = 0.7; // Base confidence
        // Increase confidence if resolution is approved
        if (resolution.status === "APPROVED") {
            confidence += 0.2;
        }
        // Increase confidence if low severity
        if (case_.severity === "LOW" || case_.severity === "MEDIUM") {
            confidence += 0.1;
        }
        // Decrease confidence if regulatory sensitivity
        if (case_.regulatorySensitivity) {
            confidence -= 0.3;
        }
        // Decrease confidence if high severity
        if (case_.severity === "CRITICAL") {
            confidence -= 0.2;
        }
        // Optionally blend in a confidence score if the plan embeds one.
        // (CaseResolution has no dedicated `metadata` field in Prisma schema.)
        const internalPlan = resolution.internalPlan && typeof resolution.internalPlan === "object"
            ? resolution.internalPlan
            : null;
        const planConfidence = internalPlan?.confidence;
        if (typeof planConfidence === "number") {
            confidence = (confidence + planConfidence) / 2;
        }
        return Math.max(0, Math.min(1, confidence));
    }
    /**
     * Identify risk factors
     */
    identifyRiskFactors(case_, resolution) {
        const risks = [];
        if (case_.regulatorySensitivity) {
            risks.push("Regulatory sensitivity");
        }
        if (case_.severity === "CRITICAL") {
            risks.push("Critical severity");
        }
        const metadata = case_.metadata;
        const financialImpact = metadata?.financialImpact;
        if (financialImpact && financialImpact > 50000) {
            risks.push("High financial impact");
        }
        if (case_.type === "FRAUD_ATO") {
            risks.push("Fraud case requires careful review");
        }
        return risks;
    }
    /**
     * Publish resolution artifact
     */
    async publishArtifact(caseId, resolution) {
        try {
            // In production, this would integrate with AAAL Studio
            // For now, we'll mark resolution as published
            await client_1.db.caseResolution.update({
                where: { caseId },
                data: {
                    status: "PUBLISHED",
                },
            });
            logger_1.logger.info("Resolution artifact published", {
                case_id: caseId,
            });
            return {
                success: true,
                artifactId: resolution.resolutionArtifactId || undefined,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to publish artifact", {
                case_id: caseId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    /**
     * Route to approval if risky
     */
    async routeToApprovalIfRisky(case_, resolution) {
        const decision = await this.determinePublishingStrategy(case_, resolution);
        if (decision.requiresApproval) {
            await client_1.db.caseResolution.update({
                where: { caseId: case_.id },
                data: {
                    status: "PENDING_APPROVAL",
                },
            });
            logger_1.logger.info("Resolution routed to approval", {
                case_id: case_.id,
                risk_factors: decision.riskFactors,
            });
            return true;
        }
        return false;
    }
}
exports.PublishingAgent = PublishingAgent;
exports.publishingAgent = new PublishingAgent();
