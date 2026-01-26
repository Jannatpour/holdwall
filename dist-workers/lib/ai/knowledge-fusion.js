"use strict";
/**
 * Knowledge-Aware Fusion
 *
 * Cross-attention and gating modules for generating grounded,
 * transparent responses from multiple knowledge sources.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeFusion = void 0;
class KnowledgeFusion {
    constructor() {
        this.openaiApiKey = null;
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Fuse RAG and KAG contexts
     */
    async fuse(input) {
        const { ragContext, kagContext, query } = input;
        // Extract knowledge from contexts
        const ragKnowledge = ragContext
            ? this.extractRAGKnowledge(ragContext)
            : [];
        const kagKnowledge = kagContext
            ? this.extractKAGKnowledge(kagContext)
            : [];
        // Fuse using cross-attention (simplified)
        const fused = await this.crossAttentionFusion(query, ragKnowledge, kagKnowledge);
        // Build sources
        const sources = [];
        if (ragContext) {
            for (const ev of ragContext.evidence) {
                sources.push({
                    type: "rag",
                    source: ev.evidence_id,
                    relevance: ragContext.metadata.relevance_scores[sources.length] || 0.7,
                });
            }
        }
        if (kagContext) {
            for (const node of kagContext.nodes) {
                sources.push({
                    type: "kag",
                    source: node.node_id,
                    relevance: node.trust_score,
                });
            }
        }
        return {
            query,
            fusedContext: fused,
            sources,
            confidence: this.calculateConfidence(ragKnowledge, kagKnowledge),
        };
    }
    /**
     * Extract knowledge from RAG context
     */
    extractRAGKnowledge(context) {
        return context.evidence.map(ev => {
            const content = typeof ev.content === "string"
                ? ev.content
                : JSON.stringify(ev.content);
            return content.substring(0, 200);
        });
    }
    /**
     * Extract knowledge from KAG context
     */
    extractKAGKnowledge(context) {
        return context.nodes.map(node => node.content);
    }
    /**
     * Cross-attention fusion
     */
    async crossAttentionFusion(query, ragKnowledge, kagKnowledge) {
        if (!this.openaiApiKey) {
            // Simple concatenation fallback
            return [...ragKnowledge, ...kagKnowledge].join("\n\n");
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
                            content: "Fuse knowledge from RAG (evidence) and KAG (knowledge graph) sources into a coherent, grounded response. Use cross-attention to identify relevant information from both sources.",
                        },
                        {
                            role: "user",
                            content: `Query: ${query}\n\nRAG Knowledge:\n${ragKnowledge.join("\n\n")}\n\nKAG Knowledge:\n${kagKnowledge.join("\n\n")}\n\nFuse into coherent answer:`,
                        },
                    ],
                    temperature: 0.3,
                }),
            });
            if (response.ok) {
                const data = await response.json();
                return data.choices[0]?.message?.content || "";
            }
        }
        catch (error) {
            console.warn("Knowledge fusion failed:", error);
        }
        // Fallback
        return [...ragKnowledge, ...kagKnowledge].join("\n\n");
    }
    /**
     * Calculate confidence
     */
    calculateConfidence(ragKnowledge, kagKnowledge) {
        // Confidence based on amount of knowledge
        const ragScore = Math.min(0.5, ragKnowledge.length * 0.1);
        const kagScore = Math.min(0.5, kagKnowledge.length * 0.1);
        return ragScore + kagScore;
    }
}
exports.KnowledgeFusion = KnowledgeFusion;
