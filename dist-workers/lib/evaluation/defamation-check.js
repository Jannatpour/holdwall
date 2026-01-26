"use strict";
/**
 * Defamation Checker
 *
 * Detects potentially defamatory content to assess legal risk.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefamationChecker = void 0;
const logger_1 = require("@/lib/logging/logger");
class DefamationChecker {
    /**
     * Check for defamatory content
     */
    async check(content, tenantId) {
        try {
            const issues = [];
            let riskLevel = "none";
            const lowerContent = content.toLowerCase();
            // Check for defamatory language patterns
            const defamatoryPatterns = [
                /\b(scam|fraud|theft|steal|illegal|criminal)\b/gi,
                /\b(lied|lying|deceive|deception)\b/gi,
                /\b(cheat|cheating|unethical)\b/gi,
                /\b(bankrupt|insolvent|failed)\b/gi,
                /\b(abuse|abusive|harass|harassment)\b/gi,
            ];
            let patternMatches = 0;
            for (const pattern of defamatoryPatterns) {
                const matches = lowerContent.match(pattern);
                if (matches) {
                    patternMatches += matches.length;
                }
            }
            if (patternMatches > 0) {
                if (patternMatches >= 5) {
                    riskLevel = "high";
                    issues.push(`High number of defamatory language patterns: ${patternMatches}`);
                }
                else if (patternMatches >= 3) {
                    riskLevel = "medium";
                    issues.push(`Moderate defamatory language patterns: ${patternMatches}`);
                }
                else {
                    riskLevel = "low";
                    issues.push(`Some defamatory language patterns detected: ${patternMatches}`);
                }
            }
            // Check for unverified accusations
            const accusationPatterns = [
                /\b(accused|alleged|claimed|reported)\s+(?:of|to have)\s+/gi,
                /\b(without evidence|unverified|unsubstantiated)\b/gi,
            ];
            let accusationCount = 0;
            for (const pattern of accusationPatterns) {
                const matches = lowerContent.match(pattern);
                if (matches) {
                    accusationCount += matches.length;
                }
            }
            if (accusationCount > 0 && riskLevel === "none") {
                riskLevel = "low";
                issues.push(`Unverified accusations detected: ${accusationCount}`);
            }
            // Check for specific person/company names with negative claims
            // (Simplified - in production use NER to identify entities)
            const negativeWithEntity = /\b(?:company|person|organization|individual)\s+(?:is|was|are|were)\s+(?:scam|fraud|illegal)/gi;
            if (negativeWithEntity.test(lowerContent)) {
                if (riskLevel === "none") {
                    riskLevel = "medium";
                }
                else if (riskLevel === "low") {
                    riskLevel = "medium";
                }
                issues.push("Specific entities mentioned with negative claims");
            }
            return {
                passed: riskLevel === "none",
                risk_level: riskLevel,
                issues,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to check defamation", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return { passed: true, risk_level: "none", issues: [] };
        }
    }
}
exports.DefamationChecker = DefamationChecker;
