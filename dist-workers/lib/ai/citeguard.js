"use strict";
/**
 * CiteGuard
 *
 * Faithful citation attribution for LLMs via retrieval-augmented
 * validation. Ensures citations are accurate and relevant.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CiteGuard = void 0;
class CiteGuard {
    constructor(ragPipeline) {
        this.openaiApiKey = null;
        this.ragPipeline = ragPipeline;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Validate citations using retrieval-augmented validation
     */
    async validate(text, citations, tenantId) {
        const validations = [];
        for (const citation of citations) {
            // Retrieve evidence for citation
            const evidence = await this.ragPipeline.retrieve(citation, tenantId, { limit: 5 });
            // Validate citation against retrieved evidence
            const validation = await this.validateCitation(text, citation, evidence);
            validations.push(validation);
        }
        // Calculate overall accuracy
        const overallAccuracy = validations.length > 0
            ? validations.reduce((sum, v) => sum + v.accuracy, 0) / validations.length
            : 0.5;
        // Generate recommendations
        const recommendations = this.generateRecommendations(validations);
        return {
            text,
            citations,
            validations,
            overallAccuracy,
            recommendations,
        };
    }
    /**
     * Validate single citation
     */
    async validateCitation(text, citation, evidence) {
        // Extract context around citation
        const citationContext = this.extractCitationContext(text, citation);
        // Check if evidence supports citation context
        let maxRelevance = 0;
        let bestMatch = "";
        for (const ev of evidence) {
            const content = typeof ev.content === "string"
                ? ev.content
                : JSON.stringify(ev.content);
            const relevance = this.calculateRelevance(citationContext, content);
            if (relevance > maxRelevance) {
                maxRelevance = relevance;
                bestMatch = content;
            }
        }
        // Validate using LLM if available
        let accuracy = 0.5;
        let reasoning = "";
        if (this.openaiApiKey && bestMatch) {
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${this.openaiApiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "system",
                                content: "Validate if the citation accurately represents the source content. Rate accuracy 0-1.",
                            },
                            {
                                role: "user",
                                content: `Citation Context: "${citationContext}"\n\nSource: "${bestMatch.substring(0, 500)}"\n\nIs the citation accurate? Rate 0-1.`,
                            },
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.2,
                    }),
                });
                if (response.ok) {
                    const data = await response.json();
                    const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
                    accuracy = parsed.accuracy || 0.5;
                    reasoning = parsed.reasoning || "";
                }
            }
            catch (error) {
                console.warn("Citation validation failed:", error);
            }
        }
        return {
            citation,
            text: citationContext,
            valid: accuracy >= 0.7 && maxRelevance >= 0.5,
            relevance: maxRelevance,
            accuracy,
            reasoning: reasoning || `Relevance: ${maxRelevance.toFixed(2)}`,
        };
    }
    /**
     * Extract context around citation
     */
    extractCitationContext(text, citation) {
        // Find citation in text
        const patterns = [
            new RegExp(`([^.!?]{0,100})\\[${citation}\\]([^.!?]{0,100})`, "i"),
            new RegExp(`([^.!?]{0,100})\\(${citation}\\)([^.!?]{0,100})`, "i"),
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return (match[1] + match[2]).trim();
            }
        }
        return text.substring(0, 200); // Fallback
    }
    /**
     * Calculate relevance
     */
    calculateRelevance(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        return union.size > 0 ? intersection.size / union.size : 0;
    }
    /**
     * Generate recommendations
     */
    generateRecommendations(validations) {
        const recommendations = [];
        const invalid = validations.filter(v => !v.valid);
        if (invalid.length > 0) {
            recommendations.push(`${invalid.length} citations need review or correction`);
        }
        const lowAccuracy = validations.filter(v => v.accuracy < 0.7);
        if (lowAccuracy.length > 0) {
            recommendations.push(`${lowAccuracy.length} citations have low accuracy - consider replacing sources`);
        }
        return recommendations;
    }
}
exports.CiteGuard = CiteGuard;
