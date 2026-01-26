"use strict";
/**
 * Citation Quality Rules (AI Governance)
 * Enforce citation requirements and quality standards for AI-generated content
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.citationRulesService = exports.CitationRulesService = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const harness_1 = require("@/lib/evaluation/harness");
class CitationRulesService {
    constructor() {
        this.evaluationHarness = new harness_1.AIAnswerEvaluationHarness();
    }
    /**
     * Create a citation rule
     */
    async create(tenantId, name, options) {
        const rule = await client_1.db.citationRule.create({
            data: {
                tenantId,
                name,
                description: options.description,
                enabled: true,
                minCitations: options.minCitations || 1,
                maxCitations: options.maxCitations,
                requiredTypes: options.requiredTypes || [],
                qualityThreshold: options.qualityThreshold || 0.7,
                enforcement: options.enforcement || "WARNING",
                metadata: options.metadata,
            },
        });
        logger_1.logger.info("Citation rule created", {
            tenantId,
            name,
            enforcement: options.enforcement || "WARNING",
        });
        return rule.id;
    }
    /**
     * Validate citations in content against rules
     */
    async validate(tenantId, content, citations, evidenceIds) {
        // Get active rules for tenant
        const rules = await client_1.db.citationRule.findMany({
            where: {
                tenantId,
                enabled: true,
            },
        });
        if (rules.length === 0) {
            // No rules, always valid
            return {
                valid: true,
                score: 1.0,
                violations: [],
                warnings: [],
                citations: {
                    count: citations.length,
                    types: [],
                    quality: 1.0,
                },
            };
        }
        const violations = [];
        const warnings = [];
        let overallScore = 1.0;
        // Extract citations from content (markdown-style [1], [evidence-id], etc.)
        const citationMatches = content.match(/\[([^\]]+)\]/g) || [];
        const extractedCitations = citationMatches.map((match) => match.slice(1, -1));
        // Evaluate citation quality using evaluation harness
        let citationQuality = 1.0;
        if (evidenceIds && evidenceIds.length > 0) {
            try {
                const evaluation = await this.evaluationHarness.evaluate(content, content, // Using content as both prompt and response for evaluation
                evidenceIds, { tenantId });
                citationQuality = evaluation.citation_capture_score;
                overallScore = evaluation.overall_score;
            }
            catch (error) {
                logger_1.logger.warn("Citation quality evaluation failed", { error });
            }
        }
        // Check each rule
        for (const rule of rules) {
            // Check minimum citations
            if (extractedCitations.length < rule.minCitations) {
                const violation = `Minimum citations not met: ${extractedCitations.length} < ${rule.minCitations}`;
                if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
                    violations.push(violation);
                }
                else {
                    warnings.push(violation);
                }
                overallScore = Math.min(overallScore, 0.5);
            }
            // Check maximum citations
            if (rule.maxCitations && extractedCitations.length > rule.maxCitations) {
                const violation = `Maximum citations exceeded: ${extractedCitations.length} > ${rule.maxCitations}`;
                if (rule.enforcement === "BLOCK") {
                    violations.push(violation);
                }
                else {
                    warnings.push(violation);
                }
            }
            // Check quality threshold
            if (citationQuality < rule.qualityThreshold) {
                const violation = `Citation quality below threshold: ${citationQuality.toFixed(2)} < ${rule.qualityThreshold}`;
                if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
                    violations.push(violation);
                }
                else {
                    warnings.push(violation);
                }
                overallScore = Math.min(overallScore, citationQuality);
            }
            // Check required types (if specified)
            if (rule.requiredTypes.length > 0) {
                // Simple type detection based on citation format
                const citationTypes = extractedCitations.map((cite) => {
                    if (cite.startsWith("evidence-"))
                        return "evidence";
                    if (cite.startsWith("claim-"))
                        return "claim";
                    if (cite.startsWith("forecast-"))
                        return "forecast";
                    return "unknown";
                });
                const missingTypes = rule.requiredTypes.filter((type) => !citationTypes.includes(type));
                if (missingTypes.length > 0) {
                    const violation = `Required citation types missing: ${missingTypes.join(", ")}`;
                    if (rule.enforcement === "BLOCK" || rule.enforcement === "REQUIRE_FIX") {
                        violations.push(violation);
                    }
                    else {
                        warnings.push(violation);
                    }
                }
            }
        }
        const valid = violations.length === 0;
        return {
            valid,
            score: overallScore,
            violations,
            warnings,
            citations: {
                count: extractedCitations.length,
                types: Array.from(new Set(extractedCitations.map((c) => {
                    if (c.startsWith("evidence-"))
                        return "evidence";
                    if (c.startsWith("claim-"))
                        return "claim";
                    if (c.startsWith("forecast-"))
                        return "forecast";
                    return "unknown";
                }))),
                quality: citationQuality,
            },
        };
    }
    /**
     * List rules for a tenant
     */
    async list(tenantId, enabledOnly = false) {
        const where = {
            tenantId,
        };
        if (enabledOnly) {
            where.enabled = true;
        }
        const rules = await client_1.db.citationRule.findMany({
            where,
            orderBy: {
                createdAt: "desc",
            },
        });
        return rules.map((r) => ({
            id: r.id,
            tenantId: r.tenantId,
            name: r.name,
            description: r.description || undefined,
            enabled: r.enabled,
            minCitations: r.minCitations,
            maxCitations: r.maxCitations || undefined,
            requiredTypes: (r.requiredTypes || []),
            qualityThreshold: r.qualityThreshold,
            enforcement: r.enforcement,
            metadata: r.metadata || undefined,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        }));
    }
    /**
     * Update a rule
     */
    async update(ruleId, updates) {
        await client_1.db.citationRule.update({
            where: { id: ruleId },
            data: updates,
        });
        logger_1.logger.info("Citation rule updated", {
            ruleId,
            updates,
        });
    }
    /**
     * Delete a rule
     */
    async delete(ruleId) {
        await client_1.db.citationRule.delete({
            where: { id: ruleId },
        });
        logger_1.logger.info("Citation rule deleted", {
            ruleId,
        });
    }
}
exports.CitationRulesService = CitationRulesService;
exports.citationRulesService = new CitationRulesService();
