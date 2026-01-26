"use strict";
/**
 * Schema-Constrained KAG
 *
 * Represents domain expert knowledge ensuring outputs align
 * with specific principles and constraints.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaConstrainedKAG = void 0;
const kag_1 = require("./kag");
class SchemaConstrainedKAG {
    constructor() {
        this.constraints = [];
        this.kagPipeline = new kag_1.KAGPipeline();
    }
    /**
     * Register schema constraint
     */
    registerConstraint(constraint) {
        this.constraints.push(constraint);
    }
    /**
     * Execute query with schema constraints
     */
    async execute(query, tenantId, constraints) {
        const activeConstraints = constraints || this.constraints;
        // Retrieve knowledge graph context
        const context = await this.kagPipeline.retrieve(query, tenantId);
        // Generate answer
        let answer = await this.generateAnswer(query, context);
        // Apply constraints
        const violations = [];
        for (const constraint of activeConstraints) {
            const violation = this.checkConstraint(answer, constraint);
            if (violation) {
                violations.push(violation);
                // Fix violation
                answer = this.fixViolation(answer, constraint);
            }
        }
        return {
            query,
            answer,
            constraints: activeConstraints,
            violations,
            confidence: violations.length === 0 ? 0.9 : 0.7,
        };
    }
    /**
     * Generate answer
     */
    async generateAnswer(query, context) {
        // Build answer from knowledge graph
        const answerParts = [];
        for (const node of context.nodes) {
            if (this.isRelevant(node.content, query)) {
                answerParts.push(node.content);
            }
        }
        return answerParts.length > 0
            ? answerParts.join(". ")
            : "Unable to generate answer.";
    }
    /**
     * Check constraint
     */
    checkConstraint(answer, constraint) {
        switch (constraint.type) {
            case "must_include":
                if (!answer.toLowerCase().includes(constraint.rule.toLowerCase())) {
                    return {
                        constraint: constraint.description,
                        reason: `Answer must include: ${constraint.rule}`,
                    };
                }
                break;
            case "must_not_include":
                if (answer.toLowerCase().includes(constraint.rule.toLowerCase())) {
                    return {
                        constraint: constraint.description,
                        reason: `Answer must not include: ${constraint.rule}`,
                    };
                }
                break;
            case "format":
                // Check format (simplified)
                if (!new RegExp(constraint.rule).test(answer)) {
                    return {
                        constraint: constraint.description,
                        reason: `Answer does not match required format`,
                    };
                }
                break;
        }
        return null;
    }
    /**
     * Fix constraint violation
     */
    fixViolation(answer, constraint) {
        switch (constraint.type) {
            case "must_include":
                if (!answer.includes(constraint.rule)) {
                    return `${answer} ${constraint.rule}`;
                }
                break;
            case "must_not_include":
                return answer.replace(new RegExp(constraint.rule, "gi"), "");
        }
        return answer;
    }
    /**
     * Check relevance
     */
    isRelevant(content, query) {
        const contentWords = new Set(content.toLowerCase().split(/\s+/));
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const intersection = new Set([...queryWords].filter(w => contentWords.has(w)));
        return intersection.size >= 2;
    }
}
exports.SchemaConstrainedKAG = SchemaConstrainedKAG;
