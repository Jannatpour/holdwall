"use strict";
/**
 * Claim Extraction + Clustering
 *
 * Claim extraction (LLM + rules) → clustering (embedding + hierarchical/online clustering)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimExtractionService = void 0;
const logger_1 = require("@/lib/logging/logger");
class ClaimExtractionService {
    constructor(evidenceVault, eventStore) {
        this.evidenceVault = evidenceVault;
        this.eventStore = eventStore;
    }
    /**
     * Extract claims from evidence using LLM + rules
     */
    async extractClaims(evidence_id, options) {
        const evidence = await this.evidenceVault.get(evidence_id);
        if (!evidence) {
            throw new Error(`Evidence ${evidence_id} not found`);
        }
        const useLLM = options?.use_llm !== false; // Default to true
        if (useLLM) {
            // Use LLM for claim extraction
            const { LLMProvider } = await Promise.resolve().then(() => __importStar(require("../llm/providers")));
            const llm = new LLMProvider();
            const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`.trim();
            if (!content) {
                throw new Error("Evidence has no content to extract claims from");
            }
            // JSON schema for structured output
            const claimSchema = {
                type: "array",
                items: {
                    type: "object",
                    required: ["canonical_text", "variants", "decisiveness"],
                    properties: {
                        canonical_text: {
                            type: "string",
                            description: "Clear, concise factual statement",
                        },
                        variants: {
                            type: "array",
                            items: { type: "string" },
                            description: "Different ways the same claim might be expressed",
                        },
                        decisiveness: {
                            type: "number",
                            minimum: 0,
                            maximum: 1,
                            description: "Decisiveness score (1 = highly factual, 0 = opinion/speculation)",
                        },
                        evidence_refs: {
                            type: "array",
                            items: { type: "string" },
                            description: "Evidence IDs supporting this claim",
                        },
                    },
                },
            };
            const prompt = `Extract factual claims from the following evidence. For each claim, provide:
1. A canonical text (clear, concise statement)
2. Variant expressions (different ways the same claim might be expressed)
3. A decisiveness score (0-1, where 1 is highly decisive/factual, 0 is opinion/speculation)
4. Evidence references (evidence IDs that support this claim)

Evidence:
${content.substring(0, 4000)}

Rules:
${options?.rules?.join("\n") || "Extract only factual, verifiable claims. Avoid opinions, speculation, or subjective statements."}

Return a JSON array of claims matching this schema:
${JSON.stringify(claimSchema, null, 2)}

Ensure the response is valid JSON and matches the schema exactly.`;
            try {
                // Use ModelRouter for intelligent model selection
                const { ModelRouter } = await Promise.resolve().then(() => __importStar(require("../ai/router")));
                const { getCostTracker } = await Promise.resolve().then(() => __importStar(require("../ai/cost-tracker")));
                const costTracker = getCostTracker();
                const router = new ModelRouter(costTracker);
                // Use JSON mode for guaranteed structured output (latest 2026 technique)
                const routingResult = await router.route({
                    model: "gpt-4o-mini", // Will be overridden by router
                    prompt: `${prompt}\n\nIMPORTANT: Return ONLY valid JSON matching the schema. Do not include any markdown, code blocks, or explanatory text.`,
                    temperature: 0.1,
                    max_tokens: 2000,
                    system_prompt: "You are a claim extraction system. Return only valid JSON matching the provided schema. Do not include markdown code blocks or any text outside the JSON.",
                    response_format: "json_object", // Enable JSON mode for guaranteed structured output
                }, {
                    tenantId: evidence.tenant_id,
                    taskType: "extract",
                    latencyConstraint: 2000, // 2s for extraction
                    citationFaithfulness: 0.8, // Require good citation quality
                });
                const response = routingResult.response;
                // Parse and validate JSON response against schema
                // With JSON mode, response should be valid JSON directly
                let claims = [];
                try {
                    // With JSON mode enabled, response should be valid JSON
                    // Try parsing directly first (JSON mode returns valid JSON)
                    let parsed;
                    try {
                        parsed = JSON.parse(response.text);
                    }
                    catch {
                        // Fallback: try to extract JSON from markdown code blocks
                        const jsonMatch = response.text.match(/```json\s*([\s\S]*?)\s*```/) ||
                            response.text.match(/```\s*([\s\S]*?)\s*```/) ||
                            response.text.match(/\[[\s\S]*\]/) ||
                            response.text.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const jsonText = jsonMatch[1] || jsonMatch[0];
                            parsed = JSON.parse(jsonText);
                        }
                        else {
                            throw new Error("No valid JSON found in response");
                        }
                    }
                    // Handle both array and object responses
                    if (Array.isArray(parsed)) {
                        claims = parsed;
                    }
                    else if (parsed.claims && Array.isArray(parsed.claims)) {
                        claims = parsed.claims;
                    }
                    else if (parsed.data && Array.isArray(parsed.data)) {
                        claims = parsed.data;
                    }
                    else {
                        // Single claim object
                        claims = [parsed];
                    }
                    // Validate against schema
                    if (!Array.isArray(claims)) {
                        throw new Error("Response is not an array");
                    }
                    for (const claim of claims) {
                        if (!claim.canonical_text || typeof claim.canonical_text !== "string") {
                            throw new Error("Invalid claim: missing or invalid canonical_text");
                        }
                        if (!Array.isArray(claim.variants)) {
                            throw new Error("Invalid claim: variants must be an array");
                        }
                        if (typeof claim.decisiveness !== "number" || claim.decisiveness < 0 || claim.decisiveness > 1) {
                            throw new Error("Invalid claim: decisiveness must be a number between 0 and 1");
                        }
                    }
                }
                catch (parseError) {
                    // If JSON parsing fails, extract claims using regex/pattern matching
                    logger_1.logger.warn("Failed to parse LLM response as JSON, using fallback extraction", {
                        error: parseError instanceof Error ? parseError.message : String(parseError),
                        evidenceId: evidence_id,
                    });
                    claims = this.fallbackClaimExtraction(content);
                }
                // Convert to Claim objects with structured output validation
                const extractedClaims = claims.map((c) => ({
                    claim_id: `claim-${crypto.randomUUID()}`,
                    tenant_id: evidence.tenant_id,
                    canonical_text: c.canonical_text,
                    variants: c.variants || [],
                    evidence_refs: c.evidence_refs && Array.isArray(c.evidence_refs)
                        ? [...c.evidence_refs, evidence_id]
                        : [evidence_id],
                    decisiveness: Math.max(0, Math.min(1, c.decisiveness || 0.5)),
                    created_at: new Date().toISOString(),
                }));
                // Emit events for each claim
                for (const claim of extractedClaims) {
                    const event = {
                        event_id: crypto.randomUUID(),
                        tenant_id: evidence.tenant_id,
                        actor_id: "claim-extractor",
                        type: "claim.extracted",
                        occurred_at: new Date().toISOString(),
                        correlation_id: crypto.randomUUID(),
                        schema_version: "1.0",
                        evidence_refs: [evidence_id],
                        payload: {
                            claim_id: claim.claim_id,
                            canonical_text: claim.canonical_text,
                            decisiveness: claim.decisiveness,
                        },
                        signatures: [],
                    };
                    await this.eventStore.append(event);
                    // Check Financial Services escalation rules (async, don't block)
                    try {
                        const { escalationEnforcer } = await Promise.resolve().then(() => __importStar(require("@/lib/financial-services/escalation-enforcer")));
                        escalationEnforcer.checkAndEscalateClaim(evidence.tenant_id, claim.claim_id, claim.canonical_text).catch((error) => {
                            logger_1.logger.warn("Financial Services escalation check failed", {
                                error: error instanceof Error ? error.message : String(error),
                                claimId: claim.claim_id,
                            });
                        });
                    }
                    catch (error) {
                        // If escalation check fails, continue (not all tenants have Financial Services enabled)
                    }
                }
                return extractedClaims;
            }
            catch (error) {
                logger_1.logger.warn("LLM claim extraction failed, using fallback", {
                    error: error instanceof Error ? error.message : String(error),
                    evidenceId: evidence_id,
                });
                // Fallback to rule-based extraction
                return this.fallbackClaimExtraction(content, evidence);
            }
        }
        else {
            // Rule-based extraction (fallback)
            const content = `${evidence.content.raw || ""} ${evidence.content.normalized || ""}`.trim();
            return this.fallbackClaimExtraction(content, evidence);
        }
    }
    /**
     * Fallback claim extraction using pattern matching
     */
    fallbackClaimExtraction(content, evidence) {
        // Simple pattern-based extraction for fallback
        const sentences = content
            .split(/[.!?]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 20);
        const claims = [];
        // Extract declarative statements (heuristic)
        for (const sentence of sentences.slice(0, 5)) {
            // Skip questions and commands
            if (sentence.match(/^(what|who|when|where|why|how|is|are|was|were)\s/i)) {
                continue;
            }
            // Extract factual statements
            if (sentence.length > 30 && sentence.length < 200) {
                const claim = {
                    claim_id: `claim-${crypto.randomUUID()}`,
                    tenant_id: evidence?.tenant_id || "",
                    canonical_text: sentence,
                    variants: [sentence], // Could generate variants with LLM
                    evidence_refs: evidence ? [evidence.evidence_id] : [],
                    decisiveness: 0.5, // Default decisiveness
                    created_at: new Date().toISOString(),
                };
                claims.push(claim);
            }
        }
        return claims;
    }
    /**
     * Cluster claims using embedding + hierarchical clustering
     */
    async clusterClaims(claims, options) {
        if (claims.length === 0) {
            return [];
        }
        const threshold = options?.similarity_threshold || 0.7;
        const method = options?.method || "hierarchical";
        // Generate embeddings for all claims
        const { EmbeddingService } = await Promise.resolve().then(() => __importStar(require("../vector/embeddings")));
        const embeddingService = new EmbeddingService();
        const claimEmbeddings = await Promise.all(claims.map(async (claim) => {
            const embedding = await embeddingService.embed(claim.canonical_text);
            return {
                claim,
                embedding: embedding.vector,
            };
        }));
        if (method === "hierarchical") {
            // Hierarchical clustering using cosine similarity
            const clusters = [];
            const used = new Set();
            for (let i = 0; i < claimEmbeddings.length; i++) {
                if (used.has(claimEmbeddings[i].claim.claim_id)) {
                    continue;
                }
                const cluster = [claimEmbeddings[i].claim];
                used.add(claimEmbeddings[i].claim.claim_id);
                // Find similar claims
                for (let j = i + 1; j < claimEmbeddings.length; j++) {
                    if (used.has(claimEmbeddings[j].claim.claim_id)) {
                        continue;
                    }
                    const similarity = embeddingService.cosineSimilarity(claimEmbeddings[i].embedding, claimEmbeddings[j].embedding);
                    if (similarity >= threshold) {
                        cluster.push(claimEmbeddings[j].claim);
                        used.add(claimEmbeddings[j].claim.claim_id);
                    }
                }
                // Sort by decisiveness to find primary claim
                cluster.sort((a, b) => b.decisiveness - a.decisiveness);
                const claimCluster = {
                    cluster_id: `cluster-${crypto.randomUUID()}`,
                    tenant_id: cluster[0].tenant_id,
                    primary_claim: cluster[0],
                    related_claims: cluster.slice(1),
                    size: cluster.length,
                    decisiveness: cluster.reduce((sum, c) => sum + c.decisiveness, 0) / cluster.length,
                    created_at: new Date().toISOString(),
                };
                // Update claims with cluster_id
                for (const claim of cluster) {
                    claim.cluster_id = claimCluster.cluster_id;
                }
                clusters.push(claimCluster);
                // Emit event
                const event = {
                    event_id: crypto.randomUUID(),
                    tenant_id: claimCluster.tenant_id,
                    actor_id: "claim-clusterer",
                    type: "claim.clustered",
                    occurred_at: new Date().toISOString(),
                    correlation_id: crypto.randomUUID(),
                    schema_version: "1.0",
                    evidence_refs: cluster.flatMap((c) => c.evidence_refs),
                    payload: {
                        cluster_id: claimCluster.cluster_id,
                        claim_ids: cluster.map((c) => c.claim_id),
                        size: cluster.length,
                    },
                    signatures: [],
                };
                await this.eventStore.append(event);
            }
            return clusters;
        }
        else {
            // Online clustering (incremental)
            const clusters = [];
            for (const { claim, embedding } of claimEmbeddings) {
                let assigned = false;
                // Try to assign to existing cluster
                for (const cluster of clusters) {
                    const primaryEmbedding = await embeddingService.embed(cluster.primary_claim.canonical_text);
                    const similarity = embeddingService.cosineSimilarity(embedding, primaryEmbedding.vector);
                    if (similarity >= threshold) {
                        cluster.related_claims.push(claim);
                        cluster.size++;
                        cluster.decisiveness =
                            (cluster.decisiveness * (cluster.size - 1) + claim.decisiveness) /
                                cluster.size;
                        claim.cluster_id = cluster.cluster_id;
                        assigned = true;
                        break;
                    }
                }
                // Create new cluster if no match
                if (!assigned) {
                    const newCluster = {
                        cluster_id: `cluster-${crypto.randomUUID()}`,
                        tenant_id: claim.tenant_id,
                        primary_claim: claim,
                        related_claims: [],
                        size: 1,
                        decisiveness: claim.decisiveness,
                        created_at: new Date().toISOString(),
                    };
                    claim.cluster_id = newCluster.cluster_id;
                    clusters.push(newCluster);
                }
            }
            // Emit events for all clusters
            for (const cluster of clusters) {
                const event = {
                    event_id: crypto.randomUUID(),
                    tenant_id: cluster.tenant_id,
                    actor_id: "claim-clusterer",
                    type: "claim.clustered",
                    occurred_at: new Date().toISOString(),
                    correlation_id: crypto.randomUUID(),
                    schema_version: "1.0",
                    evidence_refs: [
                        cluster.primary_claim,
                        ...cluster.related_claims,
                    ].flatMap((c) => c.evidence_refs),
                    payload: {
                        cluster_id: cluster.cluster_id,
                        claim_ids: [
                            cluster.primary_claim.claim_id,
                            ...cluster.related_claims.map((c) => c.claim_id),
                        ],
                        size: cluster.size,
                    },
                    signatures: [],
                };
                await this.eventStore.append(event);
            }
            return clusters;
        }
    }
}
exports.ClaimExtractionService = ClaimExtractionService;
