"use strict";
/**
 * Prompt Registry (AI Governance)
 * Versioned prompt management with approval workflows and quality tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptRegistry = exports.PromptRegistry = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
const harness_1 = require("@/lib/evaluation/harness");
class PromptRegistry {
    constructor() {
        this.evaluationHarness = new harness_1.AIAnswerEvaluationHarness();
    }
    /**
     * Register a new prompt version
     */
    async register(tenantId, name, content, options) {
        // Determine version (auto-increment if not provided)
        let version = options?.version;
        if (!version) {
            const latest = await client_1.db.prompt.findFirst({
                where: {
                    tenantId,
                    name,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
            if (latest) {
                // Parse semantic version and increment patch
                const parts = latest.version.split(".");
                if (parts.length === 3) {
                    const patch = parseInt(parts[2], 10) + 1;
                    version = `${parts[0]}.${parts[1]}.${patch}`;
                }
                else {
                    version = "1.0.0";
                }
            }
            else {
                version = "1.0.0";
            }
        }
        // Run policy checks
        const policyChecks = await this.runPolicyChecks(content, tenantId);
        // Create prompt
        const prompt = await client_1.db.prompt.create({
            data: {
                tenantId,
                name,
                version,
                content,
                description: options?.description,
                tags: options?.tags || [],
                category: options?.category,
                model: options?.model,
                temperature: options?.temperature,
                maxTokens: options?.maxTokens,
                parameters: options?.parameters,
                policyChecks: policyChecks,
                approved: false,
            },
        });
        logger_1.logger.info("Prompt registered", {
            tenantId,
            name,
            version,
            category: options?.category,
        });
        return prompt.id;
    }
    /**
     * Get a prompt by name and version (or latest)
     */
    async get(tenantId, name, version) {
        const where = {
            tenantId,
            name,
            deprecated: false,
        };
        if (version) {
            where.version = version;
        }
        const prompt = await client_1.db.prompt.findFirst({
            where,
            orderBy: version ? undefined : { createdAt: "desc" },
        });
        if (!prompt) {
            return null;
        }
        // Update usage stats
        await client_1.db.prompt.update({
            where: { id: prompt.id },
            data: {
                usageCount: {
                    increment: 1,
                },
                lastUsed: new Date(),
            },
        });
        return this.mapToPromptVersion(prompt);
    }
    /**
     * List prompts for a tenant
     */
    async list(tenantId, options) {
        const where = {
            tenantId,
        };
        if (options?.category) {
            where.category = options.category;
        }
        if (options?.approved !== undefined) {
            where.approved = options.approved;
        }
        if (options?.deprecated !== undefined) {
            where.deprecated = options.deprecated;
        }
        const prompts = await client_1.db.prompt.findMany({
            where,
            orderBy: [
                { name: "asc" },
                { createdAt: "desc" },
            ],
        });
        return prompts.map((p) => this.mapToPromptVersion(p));
    }
    /**
     * Approve a prompt version
     */
    async approve(promptId, approvedBy) {
        await client_1.db.prompt.update({
            where: { id: promptId },
            data: {
                approved: true,
                approvedBy,
                approvedAt: new Date(),
            },
        });
        logger_1.logger.info("Prompt approved", {
            promptId,
            approvedBy,
        });
    }
    /**
     * Deprecate a prompt version
     */
    async deprecate(promptId) {
        await client_1.db.prompt.update({
            where: { id: promptId },
            data: {
                deprecated: true,
                deprecatedAt: new Date(),
            },
        });
        logger_1.logger.info("Prompt deprecated", {
            promptId,
        });
    }
    /**
     * Evaluate a prompt with test cases
     */
    async evaluate(promptId, testCases) {
        const prompt = await client_1.db.prompt.findUnique({
            where: { id: promptId },
        });
        if (!prompt) {
            throw new Error(`Prompt not found: ${promptId}`);
        }
        const results = [];
        for (const testCase of testCases) {
            // Run evaluation harness
            const evaluation = await this.evaluationHarness.evaluate(prompt.content, testCase.query, // Using query as response for evaluation
            testCase.expectedEvidence, {
                model: prompt.model || undefined,
                context: testCase.context,
                tenantId: prompt.tenantId,
            });
            // Store evaluation result
            const evaluationRecord = await client_1.db.promptEvaluation.create({
                data: {
                    promptId,
                    score: evaluation.overall_score,
                    metrics: evaluation.details,
                    evaluator: prompt.model || "default",
                },
            });
            results.push({
                id: evaluationRecord.id,
                promptId,
                score: evaluation.overall_score,
                metrics: evaluation.details,
                evaluator: prompt.model || undefined,
                createdAt: evaluationRecord.createdAt,
            });
        }
        return results;
    }
    /**
     * Run policy checks on prompt content
     */
    async runPolicyChecks(content, tenantId) {
        const checks = {
            length: content.length,
            hasCitations: content.includes("[") && content.includes("]"),
            hasInstructions: content.toLowerCase().includes("instruction") || content.toLowerCase().includes("task"),
            timestamp: new Date().toISOString(),
        };
        // Check for potentially harmful content
        const harmfulPatterns = [
            /bypass/i,
            /ignore/i,
            /forget/i,
            /pretend/i,
        ];
        checks.hasHarmfulPatterns = harmfulPatterns.some((pattern) => pattern.test(content));
        // Check citation requirements (if tenant has rules)
        const citationRules = await client_1.db.citationRule.findMany({
            where: {
                tenantId,
                enabled: true,
            },
        });
        if (citationRules.length > 0) {
            checks.citationRuleCompliance = this.checkCitationCompliance(content, citationRules);
        }
        return checks;
    }
    /**
     * Check citation compliance with rules
     */
    checkCitationCompliance(content, rules) {
        // Extract citations (simple pattern matching)
        const citationMatches = content.match(/\[.*?\]/g) || [];
        const citationCount = citationMatches.length;
        const compliance = {
            citationCount,
            compliant: true,
            violations: [],
        };
        for (const rule of rules) {
            if (citationCount < rule.minCitations) {
                compliance.violations.push(`Minimum citations not met: ${citationCount} < ${rule.minCitations}`);
                compliance.compliant = false;
            }
        }
        return compliance;
    }
    /**
     * Map database model to PromptVersion
     */
    mapToPromptVersion(prompt) {
        return {
            id: prompt.id,
            tenantId: prompt.tenantId,
            name: prompt.name,
            version: prompt.version,
            content: prompt.content,
            description: prompt.description || undefined,
            tags: prompt.tags || [],
            category: prompt.category || undefined,
            model: prompt.model || undefined,
            temperature: prompt.temperature || undefined,
            maxTokens: prompt.maxTokens || undefined,
            parameters: prompt.parameters || undefined,
            policyChecks: prompt.policyChecks || undefined,
            approved: prompt.approved,
            approvedBy: prompt.approvedBy || undefined,
            approvedAt: prompt.approvedAt || undefined,
            deprecated: prompt.deprecated,
            deprecatedAt: prompt.deprecatedAt || undefined,
            usageCount: prompt.usageCount,
            lastUsed: prompt.lastUsed || undefined,
            createdAt: prompt.createdAt,
            updatedAt: prompt.updatedAt,
        };
    }
}
exports.PromptRegistry = PromptRegistry;
exports.promptRegistry = new PromptRegistry();
