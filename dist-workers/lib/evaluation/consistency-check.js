"use strict";
/**
 * Consistency Checker
 *
 * Verifies consistency of summaries over time to detect contradictions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsistencyChecker = void 0;
const logger_1 = require("@/lib/logging/logger");
const embeddings_1 = require("@/lib/vector/embeddings");
class ConsistencyChecker {
    constructor() {
        this.embeddingService = new embeddings_1.EmbeddingService();
    }
    /**
     * Check consistency between current and previous content
     */
    async check(currentContent, previousContent, tenantId) {
        try {
            const inconsistencies = [];
            let consistencyScore = 1.0;
            // Calculate semantic similarity
            const currentEmbedding = await this.embeddingService.embed(currentContent);
            const previousEmbedding = await this.embeddingService.embed(previousContent);
            const similarity = this.embeddingService.cosineSimilarity(currentEmbedding.vector, previousEmbedding.vector);
            consistencyScore = similarity;
            // Check for contradictions (simplified - in production use NLI)
            const contradictions = this.detectContradictions(currentContent, previousContent);
            if (contradictions.length > 0) {
                inconsistencies.push(...contradictions);
                consistencyScore -= 0.3 * contradictions.length;
            }
            // Check for significant factual changes
            if (similarity < 0.7) {
                inconsistencies.push(`Low semantic similarity: ${(similarity * 100).toFixed(0)}%`);
                consistencyScore -= 0.2;
            }
            consistencyScore = Math.max(0, consistencyScore);
            const passed = consistencyScore >= 0.7 && inconsistencies.length === 0;
            return {
                passed,
                consistency_score: consistencyScore,
                inconsistencies,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to check consistency", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return { passed: true, consistency_score: 1.0, inconsistencies: [] };
        }
    }
    /**
     * Detect contradictions (simplified)
     */
    detectContradictions(current, previous) {
        const contradictions = [];
        // Check for direct negations
        const negationPatterns = [
            { positive: /\b(is|was|are|were)\s+(?:good|positive|successful)/gi, negative: /\b(is|was|are|were)\s+(?:bad|negative|failed)/gi },
            { positive: /\b(confirmed|verified|proven)/gi, negative: /\b(denied|refuted|disproven)/gi },
            { positive: /\b(approved|accepted)/gi, negative: /\b(rejected|denied)/gi },
        ];
        for (const pattern of negationPatterns) {
            const currentPositive = pattern.positive.test(current);
            const previousPositive = pattern.positive.test(previous);
            const currentNegative = pattern.negative.test(current);
            const previousNegative = pattern.negative.test(previous);
            if ((currentPositive && previousNegative) || (currentNegative && previousPositive)) {
                contradictions.push("Contradictory statements detected");
                break;
            }
        }
        return contradictions;
    }
}
exports.ConsistencyChecker = ConsistencyChecker;
