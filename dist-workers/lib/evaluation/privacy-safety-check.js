"use strict";
/**
 * Privacy Safety Checker
 *
 * Verifies PII detection and GDPR/CCPA/HIPAA compliance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivacySafetyChecker = void 0;
const logger_1 = require("@/lib/logging/logger");
const pii_detection_1 = require("@/lib/signals/pii-detection");
class PrivacySafetyChecker {
    constructor() {
        this.piiDetector = new pii_detection_1.PIIDetectionService();
    }
    /**
     * Check privacy safety
     */
    async check(content, tenantId) {
        try {
            const complianceIssues = [];
            let piiDetected = false;
            // Detect PII
            const piiEntities = await this.piiDetector.detect(content);
            piiDetected = piiEntities.length > 0;
            if (piiDetected) {
                const types = Array.from(new Set(piiEntities.map((e) => e.type)));
                complianceIssues.push(`PII detected: ${types.join(", ")}`);
            }
            // Check for GDPR compliance (EU data subjects)
            const gdprKeywords = [
                /\b(eu|european union|gdpr|data subject|right to be forgotten)\b/gi,
                /\b(personal data|sensitive data)\b/gi,
            ];
            let gdprRelevant = false;
            for (const pattern of gdprKeywords) {
                if (pattern.test(content)) {
                    gdprRelevant = true;
                    break;
                }
            }
            if (gdprRelevant && piiDetected) {
                complianceIssues.push("GDPR compliance: PII detected in EU-relevant content");
            }
            // Check for CCPA compliance (California residents)
            const ccpaKeywords = [
                /\b(california|ccpa|california consumer privacy act)\b/gi,
                /\b(consumer|resident|california resident)\b/gi,
            ];
            let ccpaRelevant = false;
            for (const pattern of ccpaKeywords) {
                if (pattern.test(content)) {
                    ccpaRelevant = true;
                    break;
                }
            }
            if (ccpaRelevant && piiDetected) {
                complianceIssues.push("CCPA compliance: PII detected in California-relevant content");
            }
            // Check for HIPAA compliance (health information)
            const hipaaKeywords = [
                /\b(hipaa|health information|medical record|phi|protected health information)\b/gi,
                /\b(patient|diagnosis|treatment|prescription)\b/gi,
            ];
            let hipaaRelevant = false;
            for (const pattern of hipaaKeywords) {
                if (pattern.test(content)) {
                    hipaaRelevant = true;
                    break;
                }
            }
            if (hipaaRelevant && piiDetected) {
                complianceIssues.push("HIPAA compliance: PII detected in health-related content");
            }
            const passed = !piiDetected || complianceIssues.length === 0;
            return {
                passed,
                pii_detected: piiDetected,
                compliance_issues: complianceIssues,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to check privacy safety", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return { passed: true, pii_detected: false, compliance_issues: [] };
        }
    }
}
exports.PrivacySafetyChecker = PrivacySafetyChecker;
