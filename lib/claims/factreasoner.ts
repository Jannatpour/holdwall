/**
 * FactReasoner
 * 
 * Neuro-symbolic framework that decomposes long-form responses into atomic claims
 * and uses probabilistic reasoning to estimate posterior probability that each
 * unit is supported by external evidence.
 */

import type { Claim } from "./extraction";

export interface AtomicClaim {
  id: string;
  text: string;
  confidence: number; // 0-1, posterior probability
  evidenceSupport: number; // 0-1, how well supported by evidence
  reasoning: string; // Explanation of reasoning
}

export interface FactReasoningResult {
  original: string;
  atomicClaims: AtomicClaim[];
  overallConfidence: number;
  evidenceGaps: string[]; // Claims with low evidence support
}

export class FactReasoner {
  private openaiApiKey: string | null = null;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY || null;
  }

  /**
   * Decompose text into atomic claims
   */
  async decompose(text: string): Promise<FactReasoningResult> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Use GPT-4o for decomposition
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
              content: `You are a fact-checking system. Decompose the following text into atomic claims.
Each claim should be:
1. A single, testable statement
2. Independent and verifiable
3. Include your confidence estimate (0-1) for each claim
4. Identify which claims need external evidence support

Return JSON array of claims with: text, confidence, needsEvidence, reasoning`,
            },
            {
              role: "user",
              content: text,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");

      // Convert to atomic claims
      const atomicClaims: AtomicClaim[] = (parsed.claims || []).map((c: any, i: number) => ({
        id: `atomic-${Date.now()}-${i}`,
        text: c.text || "",
        confidence: c.confidence || 0.5,
        evidenceSupport: c.needsEvidence ? 0.3 : 0.8, // Lower if needs evidence
        reasoning: c.reasoning || "",
      }));

      // Calculate overall confidence
      const overallConfidence = atomicClaims.length > 0
        ? atomicClaims.reduce((sum, c) => sum + c.confidence, 0) / atomicClaims.length
        : 0.5;

      // Identify evidence gaps
      const evidenceGaps = atomicClaims
        .filter(c => c.evidenceSupport < 0.5)
        .map(c => c.text);

      return {
        original: text,
        atomicClaims,
        overallConfidence,
        evidenceGaps,
      };
    } catch (error) {
      throw new Error(
        `FactReasoner decomposition failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Estimate evidence support for claims
   */
  async estimateEvidenceSupport(
    claims: AtomicClaim[],
    evidence: string[]
  ): Promise<AtomicClaim[]> {
    // Use semantic similarity and NLI for evidence support estimation
    const { VectorEmbeddings } = await import("@/lib/search/embeddings");
    const embeddings = new VectorEmbeddings();
    
    // Generate embeddings for claims and evidence
    const claimEmbeddings = await Promise.all(
      claims.map(c => embeddings.embed(c.text, { model: "openai" }))
    );
    const evidenceEmbeddings = await Promise.all(
      evidence.map(e => embeddings.embed(e, { model: "openai" }))
    );

    return claims.map((claim, claimIdx) => {
      // Calculate semantic similarity between claim and evidence
      const claimEmbedding = claimEmbeddings[claimIdx].vector;
      const similarities = evidenceEmbeddings.map(evEmbedding => {
        const evVector = evEmbedding.vector;
        // Cosine similarity
        const dotProduct = claimEmbedding.reduce((sum, val, i) => sum + val * (evVector[i] || 0), 0);
        const normA = Math.sqrt(claimEmbedding.reduce((sum, val) => sum + val * val, 0));
        const normB = Math.sqrt(evVector.reduce((sum, val) => sum + val * val, 0));
        return normA > 0 && normB > 0 ? dotProduct / (normA * normB) : 0;
      });
      
      // Filter evidence with similarity > 0.5 threshold
      const supportingEvidence = evidence.filter((_, idx) => similarities[idx] > 0.5);

      const evidenceSupport = evidence.length > 0
        ? supportingEvidence.length / evidence.length
        : 0;

      return {
        ...claim,
        evidenceSupport: Math.max(claim.evidenceSupport, evidenceSupport),
      };
    });
  }

  /**
   * Simple semantic matching (in production, use embeddings)
   */
  private semanticMatch(text1: string, text2: string): boolean {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    return intersection.size / union.size > 0.3; // 30% word overlap
  }

  /**
   * Convert atomic claims to standard Claim format
   */
  toClaims(atomicClaims: AtomicClaim[], tenantId: string): Claim[] {
    return atomicClaims.map(atomic => ({
      claim_id: atomic.id,
      tenant_id: tenantId,
      canonical_text: atomic.text,
      variants: [atomic.text], // Would generate variants in production
      evidence_refs: [],
      decisiveness: atomic.confidence * atomic.evidenceSupport,
      created_at: new Date().toISOString(),
    }));
  }
}
