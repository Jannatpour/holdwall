"use strict";
/**
 * AI Answer Evaluation Harness (AIAEH)
 * Production evaluation system for LLM responses
 *
 * Integrates with advanced evaluation frameworks:
 * - DeepTRACE for citation faithfulness
 * - CiteGuard for citation accuracy
 * - GPTZero for hallucination detection
 * - Galileo Guard for safety checks
 * - Groundedness Checker for factual alignment
 * - Judge Framework for multi-judge evaluation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnswerEvaluationHarness = void 0;
const providers_1 = require("@/lib/llm/providers");
const deeptrace_1 = require("@/lib/ai/deeptrace");
const citeguard_1 = require("@/lib/ai/citeguard");
const gptzero_detector_1 = require("@/lib/ai/gptzero-detector");
const galileo_guard_1 = require("@/lib/ai/galileo-guard");
const groundedness_checker_1 = require("@/lib/ai/groundedness-checker");
const judge_framework_1 = require("@/lib/ai/judge-framework");
const rag_1 = require("@/lib/ai/rag");
const vault_db_1 = require("@/lib/evidence/vault-db");
const ragas_1 = require("@/lib/evaluation/ragas");
const logger_1 = require("@/lib/logging/logger");
class AIAnswerEvaluationHarness {
    constructor() {
        this.llmProvider = new providers_1.LLMProvider();
        this.ragPipeline = new rag_1.RAGPipeline(new vault_db_1.DatabaseEvidenceVault());
        this.deepTRACE = new deeptrace_1.DeepTRACE();
        this.citeGuard = new citeguard_1.CiteGuard(this.ragPipeline);
        this.gptZeroDetector = new gptzero_detector_1.GPTZeroDetector();
        this.galileoGuard = new galileo_guard_1.GalileoGuard();
        this.groundednessChecker = new groundedness_checker_1.GroundednessChecker();
        this.judgeFramework = new judge_framework_1.JudgeFramework();
        this.ragasEvaluator = new ragas_1.RAGASEvaluator();
    }
    /**
     * Evaluate LLM response with advanced evaluation frameworks
     */
    async evaluate(prompt, response, expectedEvidence, options) {
        // Basic citation capture score
        const citationsFound = expectedEvidence.filter((evId) => response.includes(evId)).length;
        const citationCaptureScore = expectedEvidence.length > 0
            ? citationsFound / expectedEvidence.length
            : 0.5;
        // Advanced evaluation (parallel execution)
        const advancedResults = await Promise.allSettled([
            // DeepTRACE citation audit
            this.deepTRACE.audit(response, expectedEvidence).catch(() => null),
            // CiteGuard validation
            options?.tenantId
                ? this.citeGuard.validate(response, expectedEvidence, options.tenantId).catch(() => null)
                : Promise.resolve(null),
            // GPTZero hallucination detection
            this.gptZeroDetector.detect(response, expectedEvidence).catch(() => null),
            // Galileo safety guard
            this.galileoGuard.guard(response, prompt).catch(() => null),
            // Groundedness check
            options?.context
                ? this.groundednessChecker.check(response, options.context).catch(() => null)
                : Promise.resolve(null),
            // Judge framework
            this.judgeFramework.evaluate(prompt, response, prompt).catch(() => null),
            // RAGAS evaluation (if context available)
            options?.context
                ? this.ragasEvaluator.evaluate({
                    query: prompt,
                    contexts: options.context.evidence.map((e) => e.content.normalized || e.content.raw || ""),
                    answer: response,
                    context_ids: options.context.evidence.map((e) => e.evidence_id),
                }).catch(() => null)
                : Promise.resolve(null),
        ]);
        const [deepTRACEResult, citeGuardResult, gptZeroResult, galileoResult, groundednessResult, judgesResult, ragasResult,] = advancedResults.map(r => r.status === "fulfilled" ? r.value : null);
        // Enhanced citation capture from CiteGuard
        let enhancedCitationScore = citationCaptureScore;
        if (citeGuardResult) {
            const validCitations = (citeGuardResult.validations || []).filter((v) => v.isValid).length;
            if (expectedEvidence.length > 0) {
                enhancedCitationScore = validCitations / expectedEvidence.length;
            }
        }
        // Narrative drift score (check if response introduces new negative narratives)
        const narrativeDriftScore = await this.measureNarrativeDrift(prompt, response);
        // Harmful resurfacing score (combine multiple sources)
        const harmfulResurfacingScore = await this.detectHarmfulResurfacing(response, {
            gptZero: gptZeroResult,
            galileo: galileoResult,
        });
        // Overall score (weighted average with advanced evaluation)
        let overallScore = enhancedCitationScore * 0.3 +
            (1 - narrativeDriftScore) * 0.25 +
            (1 - harmfulResurfacingScore) * 0.25;
        // Add advanced evaluation scores
        if (judgesResult) {
            overallScore += Number(judgesResult.consensusScore || 0) * 0.1;
        }
        if (groundednessResult) {
            overallScore += Number(groundednessResult.overallGroundedness || 0) * 0.1;
        }
        overallScore = Math.min(1, overallScore);
        return {
            citation_capture_score: enhancedCitationScore,
            narrative_drift_score: narrativeDriftScore,
            harmful_resurfacing_score: harmfulResurfacingScore,
            overall_score: overallScore,
            details: {
                citations_found: citationsFound,
                citations_expected: expectedEvidence.length,
                narrative_alignment: 1 - narrativeDriftScore,
                harmful_content_detected: harmfulResurfacingScore > 0.5,
            },
            advancedEvaluation: {
                deepTRACE: deepTRACEResult,
                citeGuard: citeGuardResult,
                gptZero: gptZeroResult,
                galileo: galileoResult,
                groundedness: groundednessResult,
                judges: judgesResult,
                ragas: ragasResult,
            },
        };
    }
    /**
     * Evaluate forecast quality
     */
    async evaluateForecast(forecast) {
        let score = 0.5;
        // Check confidence level
        if (forecast.confidence.level >= 0.8) {
            score += 0.2;
        }
        // Check evidence references
        if (forecast.evidence_refs && forecast.evidence_refs.length > 0) {
            score += 0.2;
        }
        // Check model quality
        if (forecast.model !== "heuristic") {
            score += 0.1;
        }
        return {
            passed: score >= 0.6,
            score,
            reason: score >= 0.6
                ? "Forecast meets quality threshold"
                : "Forecast below quality threshold",
        };
    }
    async measureNarrativeDrift(prompt, response) {
        try {
            // Use LLM to analyze narrative alignment
            const analysisPrompt = `Analyze if the following response introduces new negative narratives or drifts from the original prompt's intent.

Original Prompt: "${prompt}"

Response: "${response}"

Rate the narrative drift on a scale of 0-1, where:
- 0 = No drift, response aligns perfectly with prompt intent
- 0.5 = Some drift, introduces minor negative framing
- 1 = Significant drift, introduces major negative narratives or contradicts prompt intent

Respond with only a number between 0 and 1.`;
            const llmResponse = await this.llmProvider.call({
                model: "gpt-4o",
                prompt: analysisPrompt,
                temperature: 0.3,
                max_tokens: 50,
            });
            const driftScore = parseFloat(llmResponse.text.trim());
            return isNaN(driftScore) ? 0.5 : Math.max(0, Math.min(1, driftScore));
        }
        catch (error) {
            logger_1.logger.error("Narrative drift measurement failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to keyword-based check
            const negativeKeywords = ["terrible", "awful", "horrible", "disaster", "failed", "broken"];
            const driftCount = negativeKeywords.filter((keyword) => response.toLowerCase().includes(keyword)).length;
            return Math.min(1, driftCount / negativeKeywords.length);
        }
    }
    async detectHarmfulResurfacing(response, advancedResults) {
        // Use advanced detection results if available
        if (advancedResults?.gptZero) {
            const hallucinationScore = advancedResults.gptZero.hallucinationScore || 0;
            if (hallucinationScore > 0.7) {
                return 0.8; // High harmful content if hallucination detected
            }
        }
        if (advancedResults?.galileo) {
            const safetyScore = advancedResults.galileo.safetyScore || 1;
            if (safetyScore < 0.5) {
                return 0.7; // Medium-high harmful content if safety low
            }
        }
        try {
            // Use LLM for content moderation
            const moderationPrompt = `Analyze the following text for harmful content including scams, fraud, illegal activities, lawsuits, or other harmful claims.

Text: "${response}"

Rate the harmful content on a scale of 0-1, where:
- 0 = No harmful content detected
- 0.5 = Some potentially harmful content
- 1 = Clear harmful content (scams, fraud, illegal activities, etc.)

Respond with only a number between 0 and 1.`;
            const llmResponse = await this.llmProvider.call({
                model: "gpt-4o",
                prompt: moderationPrompt,
                temperature: 0.2,
                max_tokens: 50,
            });
            const harmfulScore = parseFloat(llmResponse.text.trim());
            return isNaN(harmfulScore) ? 0 : Math.max(0, Math.min(1, harmfulScore));
        }
        catch (error) {
            logger_1.logger.error("Harmful content detection failed", {
                error: error instanceof Error ? error.message : String(error),
            });
            // Fallback to pattern matching
            const harmfulPatterns = [
                /scam/i,
                /fraud/i,
                /illegal/i,
                /lawsuit/i,
                /sue/i,
                /criminal/i,
            ];
            const matches = harmfulPatterns.filter((pattern) => pattern.test(response)).length;
            return Math.min(1, matches / harmfulPatterns.length);
        }
    }
}
exports.AIAnswerEvaluationHarness = AIAnswerEvaluationHarness;
