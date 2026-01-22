/**
 * Golden Sets for Evaluation
 * 
 * Manages golden sets (ground truth) for continuous evaluation across domains.
 */

import { logger } from "@/lib/logging/logger";

export type GoldenSetDomain = "claims" | "evidence_linking" | "graph_updates" | "aaal_outputs";

export interface GoldenSetExample {
  id: string;
  domain: GoldenSetDomain;
  input: unknown; // Domain-specific input
  expectedOutput: unknown; // Expected output
  metadata?: {
    version?: string;
    created_at?: string;
    tags?: string[];
    difficulty?: "easy" | "medium" | "hard";
  };
}

export interface GoldenSet {
  id: string;
  domain: GoldenSetDomain;
  name: string;
  version: string;
  examples: GoldenSetExample[];
  metadata: {
    created_at: string;
    updated_at: string;
    description?: string;
    total_examples: number;
  };
}

/**
 * Golden Set Manager
 */
export class GoldenSetManager {
  private goldenSets: Map<string, GoldenSet> = new Map();
  private initialized = false;

  constructor() {
    // Intentionally avoid DB work at module-load time.
    // Initialization is performed lazily on first access.
  }

  private async getDb() {
    const mod = await import("@/lib/db/client");
    return mod.db;
  }

  /**
   * Ensure golden sets are initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initializeDefaultGoldenSets();
      this.initialized = true;
    }
  }

  /**
   * Get golden set for domain
   */
  async getGoldenSet(domain: GoldenSetDomain, version?: string): Promise<GoldenSet | null> {
    await this.ensureInitialized();
    const key = version ? `${domain}:${version}` : domain;
    return this.goldenSets.get(key) || null;
  }

  /**
   * Add golden set (in-memory and optionally to database)
   */
  async addGoldenSet(goldenSet: GoldenSet, persistToDb: boolean = false): Promise<void> {
    const key = `${goldenSet.domain}:${goldenSet.version}`;
    this.goldenSets.set(key, goldenSet);
    // Also store latest-by-domain alias for callers that don't specify version.
    this.goldenSets.set(goldenSet.domain, goldenSet);
    
    if (persistToDb) {
      try {
        const db = await this.getDb();
        // Check if golden set exists
        const existing = await db.goldenSet.findUnique({
          where: {
            domain_name_version: {
              domain: goldenSet.domain,
              name: goldenSet.name,
              version: goldenSet.version,
            },
          },
        });

        if (existing) {
          await db.goldenSet.update({
            where: { id: existing.id },
            data: {
              examples: goldenSet.examples as any,
              metadata: (goldenSet.metadata || {}) as any,
              description: goldenSet.metadata?.description,
            },
          });
        } else {
          await db.goldenSet.create({
            data: {
              domain: goldenSet.domain,
              name: goldenSet.name,
              version: goldenSet.version,
              description: goldenSet.metadata?.description,
              examples: goldenSet.examples as any,
              metadata: (goldenSet.metadata || {}) as any,
            },
          });
        }
        logger.info("Golden set persisted to database", {
          domain: goldenSet.domain,
          version: goldenSet.version,
        });
      } catch (error) {
        logger.warn("Failed to persist golden set to database", { error });
      }
    }
    
    logger.info("Golden set added", {
      domain: goldenSet.domain,
      version: goldenSet.version,
      examples: goldenSet.examples.length,
    });
  }

  /**
   * Get all examples for domain
   */
  async getExamples(domain: GoldenSetDomain, version?: string): Promise<GoldenSetExample[]> {
    await this.ensureInitialized();
    const goldenSet = await this.getGoldenSet(domain, version);
    return goldenSet?.examples || [];
  }

  /**
   * Initialize default golden sets
   * Loads from database, falls back to in-memory defaults if not found
   */
  private async initializeDefaultGoldenSets(): Promise<void> {
    try {
      // Try to load from database
      const db = await this.getDb();
      const dbGoldenSets = await db.goldenSet.findMany({
        where: {
          domain: { in: ["claims", "evidence_linking", "graph_updates", "aaal_outputs"] },
        },
      });

      if (dbGoldenSets.length > 0) {
        // Load from database
        for (const dbSet of dbGoldenSets) {
          await this.addGoldenSet({
            id: dbSet.id,
            domain: dbSet.domain as GoldenSetDomain,
            name: dbSet.name,
            version: dbSet.version,
            examples: (dbSet.examples as unknown) as GoldenSetExample[],
            metadata: {
              created_at: dbSet.createdAt.toISOString(),
              updated_at: dbSet.updatedAt.toISOString(),
              description: dbSet.description || undefined,
              total_examples: ((dbSet.examples as unknown) as GoldenSetExample[]).length,
              ...((dbSet.metadata as object) || {}),
            },
          }, false); // Don't persist again, already in DB
        }
        logger.info("Loaded golden sets from database", { count: dbGoldenSets.length });
        return;
      }
    } catch (error) {
      logger.warn("Failed to load golden sets from database, using defaults", { error });
    }

    // Fallback to in-memory defaults (curated starter sets)
    await this.addGoldenSet({
      id: "claims-v1",
      domain: "claims",
      name: "Claims Extraction Golden Set",
      version: "1.0.0",
      examples: this.generateClaimsExamples(),
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: "Golden set for claim extraction evaluation",
        total_examples: 8,
      },
    }, false);

    await this.addGoldenSet({
      id: "evidence-linking-v1",
      domain: "evidence_linking",
      name: "Evidence Linking Golden Set",
      version: "1.0.0",
      examples: this.generateEvidenceLinkingExamples(),
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: "Golden set for evidence linking evaluation",
        total_examples: 6,
      },
    }, false);

    await this.addGoldenSet({
      id: "graph-updates-v1",
      domain: "graph_updates",
      name: "Graph Updates Golden Set",
      version: "1.0.0",
      examples: this.generateGraphUpdateExamples(),
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: "Golden set for graph update evaluation",
        total_examples: 6,
      },
    }, false);

    await this.addGoldenSet({
      id: "aaal-outputs-v1",
      domain: "aaal_outputs",
      name: "AAAL Outputs Golden Set",
      version: "1.0.0",
      examples: this.generateAAALOutputExamples(),
      metadata: {
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        description: "Golden set for AAAL output evaluation",
        total_examples: 6,
      },
    }, false);
  }

  /**
   * Generate claims extraction examples (curated starter set)
   */
  private generateClaimsExamples(): GoldenSetExample[] {
    return [
      {
        id: "claim-1",
        domain: "claims",
        input: {
          text: "The company reported revenue of $1.2 billion in Q4 2024.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Company reported revenue of $1.2 billion in Q4 2024",
              decisiveness: 0.95,
              evidence_refs: ["evidence-earnings-q4-2024"],
            },
          ],
        },
        metadata: {
          difficulty: "easy",
          tags: ["financial", "revenue"],
        },
      },
      {
        id: "claim-2",
        domain: "claims",
        input: {
          text: "According to the WHO, malaria cases declined by 7% between 2019 and 2022.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "WHO reports malaria cases declined by 7% between 2019 and 2022",
              decisiveness: 0.9,
              evidence_refs: ["evidence-who-malaria-2019-2022"],
            },
          ],
        },
        metadata: {
          difficulty: "medium",
          tags: ["health", "statistics"],
        },
      },
      {
        id: "claim-3",
        domain: "claims",
        input: {
          text: "The contract states the supplier must deliver within 10 business days after purchase order acceptance.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Supplier must deliver within 10 business days after purchase order acceptance",
              decisiveness: 0.85,
              evidence_refs: ["evidence-contract-delivery-terms"],
            },
          ],
        },
        metadata: {
          difficulty: "easy",
          tags: ["legal", "sla"],
        },
      },
      {
        id: "claim-4",
        domain: "claims",
        input: {
          text: "In the internal memo, leadership indicated layoffs would affect approximately 5% of the workforce.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Leadership indicated layoffs would affect approximately 5% of the workforce",
              decisiveness: 0.8,
              evidence_refs: ["evidence-internal-memo-layoffs"],
            },
          ],
        },
        metadata: {
          difficulty: "medium",
          tags: ["hr", "internal"],
        },
      },
      {
        id: "claim-5",
        domain: "claims",
        input: {
          text: "The press release says the product is 'the most secure on the market' without citing any benchmarks.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Press release claims product is the most secure on the market",
              decisiveness: 0.6,
              evidence_refs: ["evidence-press-release-security-claim"],
            },
          ],
        },
        metadata: {
          difficulty: "hard",
          tags: ["marketing", "unverifiable"],
        },
      },
      {
        id: "claim-6",
        domain: "claims",
        input: {
          text: "The invoice shows a total due of $3,450 with payment terms Net 30.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Invoice total due is $3,450 with payment terms Net 30",
              decisiveness: 0.9,
              evidence_refs: ["evidence-invoice-3450-net30"],
            },
          ],
        },
        metadata: {
          difficulty: "easy",
          tags: ["finance", "invoice"],
        },
      },
      {
        id: "claim-7",
        domain: "claims",
        input: {
          text: "The system log indicates the API returned 500 errors for 3 minutes starting at 14:02 UTC.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "API returned 500 errors for 3 minutes starting at 14:02 UTC",
              decisiveness: 0.85,
              evidence_refs: ["evidence-system-log-500s"],
            },
          ],
        },
        metadata: {
          difficulty: "medium",
          tags: ["observability", "incident"],
        },
      },
      {
        id: "claim-8",
        domain: "claims",
        input: {
          text: "The research paper concludes the method improves accuracy by 2.1 points on the benchmark.",
        },
        expectedOutput: {
          claims: [
            {
              canonical_text: "Research paper concludes method improves accuracy by 2.1 points on the benchmark",
              decisiveness: 0.75,
              evidence_refs: ["evidence-paper-benchmark-results"],
            },
          ],
        },
        metadata: {
          difficulty: "medium",
          tags: ["research", "benchmark"],
        },
      },
    ];
  }

  /**
   * Generate evidence linking examples
   */
  private generateEvidenceLinkingExamples(): GoldenSetExample[] {
    return [
      {
        id: "evidence-link-1",
        domain: "evidence_linking",
        input: {
          claim: "Company revenue was $1.2B in Q4 2024",
          evidence_candidates: ["evidence-earnings-q4-2024", "evidence-blog-post", "evidence-press-release"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-earnings-q4-2024"],
          confidence: 0.95,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "evidence-link-2",
        domain: "evidence_linking",
        input: {
          claim: "API returned 500 errors for 3 minutes starting 14:02 UTC",
          evidence_candidates: ["evidence-system-log-500s", "evidence-status-page", "evidence-chat-message"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-system-log-500s"],
          confidence: 0.9,
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "evidence-link-3",
        domain: "evidence_linking",
        input: {
          claim: "Supplier must deliver within 10 business days after PO acceptance",
          evidence_candidates: ["evidence-contract-delivery-terms", "evidence-sow", "evidence-email-thread"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-contract-delivery-terms"],
          confidence: 0.9,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "evidence-link-4",
        domain: "evidence_linking",
        input: {
          claim: "WHO reports malaria cases declined by 7% between 2019 and 2022",
          evidence_candidates: ["evidence-who-malaria-2019-2022", "evidence-news-summary", "evidence-wikipedia"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-who-malaria-2019-2022"],
          confidence: 0.92,
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "evidence-link-5",
        domain: "evidence_linking",
        input: {
          claim: "Invoice total due is $3,450 with payment terms Net 30",
          evidence_candidates: ["evidence-invoice-3450-net30", "evidence-email-reminder", "evidence-po"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-invoice-3450-net30"],
          confidence: 0.95,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "evidence-link-6",
        domain: "evidence_linking",
        input: {
          claim: "Product is the most secure on the market",
          evidence_candidates: ["evidence-press-release-security-claim", "evidence-third-party-benchmark", "evidence-audit-report"],
        },
        expectedOutput: {
          linked_evidence: ["evidence-press-release-security-claim"],
          confidence: 0.7,
        },
        metadata: { difficulty: "hard" },
      },
    ];
  }

  /**
   * Generate graph update examples
   */
  private generateGraphUpdateExamples(): GoldenSetExample[] {
    return [
      {
        id: "graph-update-1",
        domain: "graph_updates",
        input: {
          claim: "Company reported revenue of $1.2B in Q4 2024",
          existing_nodes: ["Company:Acme", "Metric:Revenue"],
        },
        expectedOutput: {
          new_nodes: ["Period:2024Q4", "Value:USD_1.2B"],
          new_edges: ["Company:Acme->reported->Metric:Revenue", "Metric:Revenue->value->Value:USD_1.2B"],
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "graph-update-2",
        domain: "graph_updates",
        input: {
          claim: "Supplier must deliver within 10 business days after PO acceptance",
          existing_nodes: ["Contract:MSA-001", "Party:Supplier"],
        },
        expectedOutput: {
          new_nodes: ["SLA:Delivery", "Duration:10_business_days"],
          new_edges: ["Contract:MSA-001->requires->SLA:Delivery", "SLA:Delivery->duration->Duration:10_business_days"],
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "graph-update-3",
        domain: "graph_updates",
        input: {
          claim: "API returned 500 errors for 3 minutes starting at 14:02 UTC",
          existing_nodes: ["Service:API", "Incident:Current"],
        },
        expectedOutput: {
          new_nodes: ["Metric:HTTP_500", "Window:3_minutes", "Time:14:02UTC"],
          new_edges: ["Service:API->emitted->Metric:HTTP_500", "Incident:Current->startedAt->Time:14:02UTC"],
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "graph-update-4",
        domain: "graph_updates",
        input: {
          claim: "Invoice total due is $3,450 with payment terms Net 30",
          existing_nodes: ["Document:Invoice", "Party:Customer"],
        },
        expectedOutput: {
          new_nodes: ["Value:USD_3450", "Term:Net30"],
          new_edges: ["Document:Invoice->amountDue->Value:USD_3450", "Document:Invoice->paymentTerms->Term:Net30"],
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "graph-update-5",
        domain: "graph_updates",
        input: {
          claim: "WHO reports malaria cases declined by 7% between 2019 and 2022",
          existing_nodes: ["Org:WHO", "Topic:Malaria"],
        },
        expectedOutput: {
          new_nodes: ["Change:-7_percent", "Period:2019_2022"],
          new_edges: ["Org:WHO->reported->Topic:Malaria", "Topic:Malaria->change->Change:-7_percent"],
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "graph-update-6",
        domain: "graph_updates",
        input: {
          claim: "Research paper concludes method improves accuracy by 2.1 points on the benchmark",
          existing_nodes: ["Artifact:Paper", "Metric:Accuracy"],
        },
        expectedOutput: {
          new_nodes: ["Delta:+2.1_points", "Benchmark:Named"],
          new_edges: ["Artifact:Paper->concludes->Delta:+2.1_points", "Metric:Accuracy->measuredOn->Benchmark:Named"],
        },
        metadata: { difficulty: "medium" },
      },
    ];
  }

  /**
   * Generate AAAL output examples
   */
  private generateAAALOutputExamples(): GoldenSetExample[] {
    return [
      {
        id: "aaal-output-1",
        domain: "aaal_outputs",
        input: {
          query: "Summarize the Q4 revenue claim and provide evidence citations",
          context: "Evidence: earnings report excerpt states revenue is $1.2B for Q4 2024.",
        },
        expectedOutput: {
          artifact: {
            title: "Q4 2024 Revenue Summary",
            content: "The earnings report states revenue was $1.2B in Q4 2024.",
            citations: ["evidence-earnings-q4-2024"],
          },
          citation_faithfulness: 0.95,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "aaal-output-2",
        domain: "aaal_outputs",
        input: {
          query: "Generate an incident note for the 500 error spike",
          context: "System log indicates HTTP 500 errors between 14:02 and 14:05 UTC.",
        },
        expectedOutput: {
          artifact: {
            title: "Incident Note: HTTP 500 Spike",
            content: "Service experienced HTTP 500 errors for ~3 minutes starting at 14:02 UTC. Investigate upstream dependency and deploy logs.",
            citations: ["evidence-system-log-500s"],
          },
          citation_faithfulness: 0.9,
        },
        metadata: { difficulty: "medium" },
      },
      {
        id: "aaal-output-3",
        domain: "aaal_outputs",
        input: {
          query: "Extract the delivery SLA from the contract",
          context: "Contract clause: deliver within 10 business days after PO acceptance.",
        },
        expectedOutput: {
          artifact: {
            title: "Delivery SLA",
            content: "Supplier must deliver within 10 business days after purchase order acceptance.",
            citations: ["evidence-contract-delivery-terms"],
          },
          citation_faithfulness: 0.95,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "aaal-output-4",
        domain: "aaal_outputs",
        input: {
          query: "Create a finance note from invoice terms",
          context: "Invoice shows total due $3,450 with payment terms Net 30.",
        },
        expectedOutput: {
          artifact: {
            title: "Invoice Summary",
            content: "Invoice total due is $3,450 with Net 30 payment terms.",
            citations: ["evidence-invoice-3450-net30"],
          },
          citation_faithfulness: 0.95,
        },
        metadata: { difficulty: "easy" },
      },
      {
        id: "aaal-output-5",
        domain: "aaal_outputs",
        input: {
          query: "Assess the marketing security claim quality",
          context: "Press release claims 'most secure on the market' with no benchmarks.",
        },
        expectedOutput: {
          artifact: {
            title: "Claim Quality Assessment",
            content: "The claim is comparative and lacks supporting benchmarks; treat as low-confidence until independent evidence is provided.",
            citations: ["evidence-press-release-security-claim"],
          },
          citation_faithfulness: 0.85,
        },
        metadata: { difficulty: "hard" },
      },
      {
        id: "aaal-output-6",
        domain: "aaal_outputs",
        input: {
          query: "Summarize benchmark improvement finding",
          context: "Paper reports +2.1 accuracy points on benchmark.",
        },
        expectedOutput: {
          artifact: {
            title: "Benchmark Result Summary",
            content: "The paper reports an accuracy improvement of 2.1 points on the stated benchmark.",
            citations: ["evidence-paper-benchmark-results"],
          },
          citation_faithfulness: 0.9,
        },
        metadata: { difficulty: "medium" },
      },
    ];
  }
}

// Singleton instance
let goldenSetManagerInstance: GoldenSetManager | null = null;

export function getGoldenSetManager(): GoldenSetManager {
  if (!goldenSetManagerInstance) {
    goldenSetManagerInstance = new GoldenSetManager();
  }
  return goldenSetManagerInstance;
}
