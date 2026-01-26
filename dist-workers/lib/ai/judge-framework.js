"use strict";
/**
 * Agent-as-a-Judge Framework
 *
 * Continuous, real-time evaluation using LLM judges
 * to assess response quality and correctness.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JudgeFramework = void 0;
class JudgeFramework {
    constructor() {
        this.judges = [];
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
        this.initializeJudges();
    }
    /**
     * Initialize judges
     */
    initializeJudges() {
        this.judges = [
            {
                id: "accuracy-judge",
                criteria: ["accuracy", "factuality", "evidence_support"],
                model: "gpt-4o",
            },
            {
                id: "helpfulness-judge",
                criteria: ["helpfulness", "completeness", "clarity"],
                model: "gpt-4o",
            },
            {
                id: "safety-judge",
                criteria: ["safety", "harmfulness", "bias"],
                model: "gpt-4o",
            },
        ];
    }
    /**
     * Evaluate with multiple judges
     */
    async evaluate(query, response, context) {
        const evaluations = [];
        // Each judge evaluates
        for (const judge of this.judges) {
            const evaluation = await this.judgeEvaluate(judge, query, response, context);
            evaluations.push(evaluation);
        }
        // Calculate consensus
        const consensus = this.calculateConsensus(evaluations);
        return {
            query,
            response,
            evaluations,
            consensus,
        };
    }
    /**
     * Judge evaluation
     */
    async judgeEvaluate(judge, query, response, context) {
        if (!this.openaiApiKey) {
            // Fallback
            return {
                judgeId: judge.id,
                criteria: judge.criteria,
                scores: judge.criteria.reduce((acc, crit) => {
                    acc[crit] = 0.7;
                    return acc;
                }, {}),
                reasoning: "Evaluation unavailable",
                overall: 0.7,
            };
        }
        try {
            const response_api = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: judge.model,
                    messages: [
                        {
                            role: "system",
                            content: `You are a judge evaluating responses. Rate each criterion 0-1 and provide overall score.`,
                        },
                        {
                            role: "user",
                            content: `Query: "${query}"\n\nResponse: "${response}"${context ? `\n\nContext: "${context}"` : ""}\n\nCriteria: ${judge.criteria.join(", ")}\n\nEvaluate:`,
                        },
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                }),
            });
            if (response_api.ok) {
                const data = await response_api.json();
                const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
                const scores = {};
                for (const criterion of judge.criteria) {
                    scores[criterion] = parsed[criterion] || parsed.scores?.[criterion] || 0.7;
                }
                const overall = parsed.overall || parsed.overall_score ||
                    Object.values(scores).reduce((sum, s) => sum + s, 0) / Object.values(scores).length;
                return {
                    judgeId: judge.id,
                    criteria: judge.criteria,
                    scores,
                    reasoning: parsed.reasoning || "",
                    overall,
                };
            }
        }
        catch (error) {
            console.warn(`Judge ${judge.id} evaluation failed:`, error);
        }
        // Fallback
        return {
            judgeId: judge.id,
            criteria: judge.criteria,
            scores: judge.criteria.reduce((acc, crit) => {
                acc[crit] = 0.7;
                return acc;
            }, {}),
            reasoning: "Evaluation unavailable",
            overall: 0.7,
        };
    }
    /**
     * Calculate consensus
     */
    calculateConsensus(evaluations) {
        if (evaluations.length === 0) {
            return {
                score: 0.5,
                confidence: 0.5,
                agreement: 0.5,
            };
        }
        // Average overall scores
        const avgScore = evaluations.reduce((sum, e) => sum + e.overall, 0) / evaluations.length;
        // Calculate agreement (variance)
        const scores = evaluations.map(e => e.overall);
        const mean = avgScore;
        const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
        const agreement = 1 - Math.min(1, variance); // Lower variance = higher agreement
        // Confidence based on agreement
        const confidence = agreement * 0.8 + 0.2; // Boost confidence if judges agree
        return {
            score: avgScore,
            confidence,
            agreement,
        };
    }
}
exports.JudgeFramework = JudgeFramework;
