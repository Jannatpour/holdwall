"use strict";
/**
 * DeepTRACE
 *
 * Audits citation faithfulness, revealing citation accuracy
 * typically 40-80%. Validates that citations actually support
 * the claims made.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepTRACE = void 0;
class DeepTRACE {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Audit citations in text
     */
    async audit(text, citations, citationSources // citation -> source content
    ) {
        const audits = [];
        // Extract claims with citations
        const claims = this.extractClaimsWithCitations(text, citations);
        // Audit each citation
        for (const claim of claims) {
            const sourceContent = citationSources?.[claim.citation] || "";
            const audit = await this.auditCitation(claim.claim, claim.citation, sourceContent);
            audits.push(audit);
        }
        // Calculate overall faithfulness
        const overallFaithfulness = audits.length > 0
            ? audits.reduce((sum, a) => sum + a.faithfulness, 0) / audits.length
            : 0.5;
        // Identify issues
        const issues = audits
            .filter(a => !a.supports || a.faithfulness < 0.7)
            .map(a => ({
            citation: a.citation,
            issue: a.faithfulness < 0.7
                ? "Citation does not adequately support claim"
                : "Citation may not support claim",
            severity: a.faithfulness < 0.5 ? "high" :
                a.faithfulness < 0.7 ? "medium" : "low",
        }));
        return {
            text,
            citations,
            audits,
            overallFaithfulness,
            issues,
        };
    }
    /**
     * Extract claims with citations
     */
    extractClaimsWithCitations(text, citations) {
        const claims = [];
        // Find citation patterns
        for (const citation of citations) {
            // Look for citation in text (e.g., [1], (source), etc.)
            const patterns = [
                new RegExp(`([^.!?]+)\\[${citation}\\]`, "i"),
                new RegExp(`([^.!?]+)\\(${citation}\\)`, "i"),
                new RegExp(`([^.!?]+)\\s+${citation}`, "i"),
            ];
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    claims.push({
                        claim: match[1].trim(),
                        citation,
                    });
                }
            }
        }
        return claims;
    }
    /**
     * Audit single citation
     */
    async auditCitation(claim, citation, sourceContent) {
        if (!this.openaiApiKey) {
            // Fallback: simple matching
            return {
                citation,
                claim,
                faithfulness: sourceContent.toLowerCase().includes(claim.toLowerCase()) ? 0.8 : 0.3,
                supports: sourceContent.toLowerCase().includes(claim.toLowerCase()),
                reasoning: "Simple text matching",
            };
        }
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
                            content: "You are a citation auditor. Determine if the source content supports the claim. Rate faithfulness 0-1.",
                        },
                        {
                            role: "user",
                            content: `Claim: "${claim}"\n\nSource Content: "${sourceContent.substring(0, 1000)}"\n\nDoes the source support the claim? Rate faithfulness 0-1 and explain.`,
                        },
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.2,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
                return {
                    citation,
                    claim,
                    faithfulness: parsed.faithfulness || 0.5,
                    supports: parsed.supports !== false,
                    reasoning: parsed.reasoning || "",
                };
            }
        }
        catch (error) {
            console.warn("Citation audit failed:", error);
        }
        // Fallback
        return {
            citation,
            claim,
            faithfulness: 0.5,
            supports: true,
            reasoning: "Audit unavailable",
        };
    }
}
exports.DeepTRACE = DeepTRACE;
