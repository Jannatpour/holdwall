/**
 * Groundedness Detection
 * 
 * Factual alignment between model outputs and retrieved context.
 * Ensures responses are grounded in evidence.
 */

import { RAGContext } from "./rag";
import { LLMProvider } from "@/lib/llm/providers";
import { EmbeddingService } from "@/lib/vector/embeddings";

export interface GroundednessResult {
  text: string;
  grounded: boolean;
  groundednessScore: number; // 0-1
  evidenceAlignment: Array<{
    claim: string;
    evidenceId: string;
    alignment: number; // 0-1
    citation?: string; // Specific citation text
  }>;
  ungroundedClaims: string[];
  citationCoverage: number; // Percentage of claims with citations
}

export class GroundednessChecker {
  private llmProvider: LLMProvider;
  private embeddingService: EmbeddingService;

  constructor() {
    this.llmProvider = new LLMProvider();
    this.embeddingService = new EmbeddingService();
  }

  /**
   * Check groundedness against evidence
   */
  async check(
    text: string,
    context: RAGContext
  ): Promise<GroundednessResult> {
    // Extract claims from text using NLP
    const claims = await this.extractClaims(text);

    // Check alignment with evidence
    const evidenceAlignment: GroundednessResult["evidenceAlignment"] = [];
    const ungroundedClaims: string[] = [];

    // Use embeddings for initial similarity filtering, then LLM for precise alignment
    const claimEmbeddings = await Promise.all(
      claims.map(claim => this.embeddingService.embed(claim))
    );

    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const claimEmbedding = claimEmbeddings[i];
      let maxAlignment = 0;
      let bestEvidenceId = "";
      let bestCitation = "";

      // First pass: use embeddings for fast similarity filtering
      const evidenceScores = await Promise.all(
        context.evidence.map(async (ev) => {
          const content = typeof ev.content === "string"
            ? ev.content
            : (ev.content?.raw || ev.content?.normalized || JSON.stringify(ev.content));
          
          const evidenceEmbedding = await this.embeddingService.embed(content);
          const similarity = this.embeddingService.cosineSimilarity(
            claimEmbedding.vector,
            evidenceEmbedding.vector
          );
          
          return { ev, similarity, content };
        })
      );

      // Sort by similarity and check top candidates with LLM
      const topCandidates = evidenceScores
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3); // Check top 3 most similar

      for (const candidate of topCandidates) {
        // Use LLM for precise alignment if similarity is reasonable
        if (candidate.similarity >= 0.3) {
          const alignment = await this.calculateAlignment(claim, candidate.content);
          if (alignment > maxAlignment) {
            maxAlignment = alignment;
            bestEvidenceId = candidate.ev.evidence_id;
            // Extract citation snippet
            bestCitation = this.extractCitation(claim, candidate.content);
          }
        }
      }

      // If no good alignment found, use embedding similarity as fallback
      if (maxAlignment < 0.5 && topCandidates.length > 0) {
        maxAlignment = topCandidates[0].similarity;
        bestEvidenceId = topCandidates[0].ev.evidence_id;
        bestCitation = this.extractCitation(claim, topCandidates[0].content);
      }

      if (maxAlignment >= 0.5) {
        evidenceAlignment.push({
          claim,
          evidenceId: bestEvidenceId,
          alignment: maxAlignment,
          citation: bestCitation || undefined,
        });
      } else {
        ungroundedClaims.push(claim);
      }
    }

    // Calculate overall groundedness
    const groundednessScore = claims.length > 0
      ? evidenceAlignment.length / claims.length
      : 0.5;

    const citationCoverage = claims.length > 0
      ? evidenceAlignment.filter(ea => ea.citation).length / claims.length
      : 0;

    const grounded = groundednessScore >= 0.7 && ungroundedClaims.length === 0 && citationCoverage >= 0.5;

    return {
      text,
      grounded,
      groundednessScore,
      evidenceAlignment,
      ungroundedClaims,
      citationCoverage,
    };
  }

  /**
   * Extract claims from text using structured LLM-based extraction
   */
  private async extractClaims(text: string): Promise<string[]> {
    try {
      const prompt = `Extract all factual claims from the following text. A claim is a declarative statement that can be verified or refuted. 

For each claim, identify:
- The specific factual assertion
- Any supporting evidence mentioned in the text

Text:
${text.substring(0, 4000)}

Return a JSON object with this structure:
{
  "claims": ["claim1", "claim2", ...]
}

Extract only factual, verifiable claims. Avoid:
- Questions
- Opinions without evidence
- Speculation
- Commands or requests`;

      const response = await this.llmProvider.call({
        model: "gpt-4o",
        prompt,
        system_prompt: "You are a claim extraction system. Extract factual, verifiable claims from text. Return a JSON object with a 'claims' array.",
        temperature: 0.2,
        max_tokens: 2000,
      });

      // Parse LLM response
      let claims: string[] = [];
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          claims = Array.isArray(parsed.claims) ? parsed.claims : [];
        } else {
          // Try parsing entire response
          const parsed = JSON.parse(response.text);
          claims = Array.isArray(parsed.claims) ? parsed.claims : [];
        }
      } catch (parseError) {
        console.warn("Failed to parse LLM claim extraction response, using fallback:", parseError);
      }

      if (claims.length > 0) {
        return claims;
      }
    } catch (error) {
      console.warn("LLM claim extraction failed, using pattern-based fallback:", error);
    }

    // Fallback: Pattern-based extraction with improved heuristics
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    // Enhanced claim indicators
    const claimIndicators = [
      "is", "are", "was", "were", "has", "have", "had",
      "shows", "indicates", "proves", "demonstrates", "suggests",
      "according to", "research shows", "studies indicate",
      "evidence", "data", "findings", "results"
    ];
    
    return sentences.filter(s => {
      const lower = s.toLowerCase();
      // Check for claim indicators
      const hasIndicator = claimIndicators.some(indicator => lower.includes(indicator));
      // Check for factual structure (subject + verb + object)
      const hasFactualStructure = /^[A-Z][^.!?]+\s+(is|are|was|were|has|have|shows|indicates)/i.test(s.trim());
      return hasIndicator || hasFactualStructure;
    });
  }

  /**
   * Calculate alignment between claim and evidence using LLM
   */
  private async calculateAlignment(
    claim: string,
    evidence: string
  ): Promise<number> {
    try {
      const prompt = `Evaluate how well the evidence supports or contradicts the claim. Consider:
1. Direct support: Evidence explicitly states or strongly implies the claim
2. Indirect support: Evidence provides relevant context that supports the claim
3. Contradiction: Evidence contradicts the claim
4. No relation: Evidence is unrelated to the claim

Claim: "${claim}"

Evidence: "${evidence.substring(0, 1000)}"

Return a JSON object with:
{
  "alignment": 0.0-1.0,
  "reason": "brief explanation"
}

Alignment scores:
- 0.8-1.0: Strong direct support
- 0.6-0.8: Good support with some context
- 0.4-0.6: Weak or indirect support
- 0.2-0.4: Contradiction or weak relation
- 0.0-0.2: No relation or strong contradiction`;

      const response = await this.llmProvider.call({
        model: "gpt-4o",
        prompt,
        system_prompt: "You are an evidence alignment evaluator. Assess how well evidence supports claims with precise scoring.",
        temperature: 0.2,
        max_tokens: 500,
      });

      // Parse response
      try {
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const alignment = parsed.alignment || parsed.score;
          if (typeof alignment === "number" && alignment >= 0 && alignment <= 1) {
            return alignment;
          }
        }
      } catch (parseError) {
        console.warn("Failed to parse alignment response:", parseError);
      }
    } catch (error) {
      console.warn("LLM alignment calculation failed, using embedding similarity:", error);
    }

    // Fallback: Use embedding similarity
    return this.embeddingSimilarity(claim, evidence);
  }

  /**
   * Calculate similarity using embeddings
   */
  private async embeddingSimilarity(claim: string, evidence: string): Promise<number> {
    try {
      const claimEmbedding = await this.embeddingService.embed(claim);
      const evidenceEmbedding = await this.embeddingService.embed(evidence);
      return this.embeddingService.cosineSimilarity(
        claimEmbedding.vector,
        evidenceEmbedding.vector
      );
    } catch (error) {
      console.warn("Embedding similarity failed, using text similarity:", error);
      return this.semanticSimilarity(claim, evidence);
    }
  }

  /**
   * Extract citation snippet from evidence that supports the claim
   */
  private extractCitation(claim: string, evidence: string): string {
    // Find the most relevant sentence or phrase in evidence
    const sentences = evidence.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Use keyword matching to find relevant sentence
    const claimWords = new Set(claim.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let bestSentence = "";
    let bestScore = 0;

    for (const sentence of sentences) {
      const sentenceWords = new Set(sentence.toLowerCase().split(/\s+/));
      const intersection = new Set([...claimWords].filter(w => sentenceWords.has(w)));
      const score = intersection.size / claimWords.size;
      
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence.trim();
      }
    }

    // Return best sentence or first 200 chars if no good match
    if (bestSentence && bestScore > 0.2) {
      return bestSentence.substring(0, 200);
    }

    return evidence.substring(0, 200);
  }

  /**
   * Semantic similarity (fallback)
   */
  private semanticSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}
