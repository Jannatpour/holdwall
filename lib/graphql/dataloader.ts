/**
 * DataLoader for GraphQL N+1 Prevention
 * Batches and caches database queries
 */

import { db } from "@/lib/db/client";

export class GraphQLDataLoader {
  private evidenceCache: Map<string, Promise<any>> = new Map();
  private claimCache: Map<string, Promise<any>> = new Map();

  /**
   * Batch load evidence by IDs
   */
  async loadEvidence(ids: string[]): Promise<Array<any | null>> {
    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(ids));
    
    // Check cache first
    const cached: Array<any | null> = [];
    const uncachedIds: string[] = [];

    for (const id of ids) {
      const cachedPromise = this.evidenceCache.get(id);
      if (cachedPromise) {
        cached.push(await cachedPromise);
      } else {
        cached.push(null);
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      return cached;
    }

    // Batch load uncached evidence
    const evidenceRecords = await db.evidence.findMany({
      where: { id: { in: uncachedIds } },
    });

    // Create a map for quick lookup
    const evidenceMap = new Map(evidenceRecords.map((e) => [e.id, e]));

    // Fill in results
    const results: Array<any | null> = [];
    let uncachedIndex = 0;

    for (let i = 0; i < ids.length; i++) {
      if (cached[i] !== null) {
        results.push(cached[i]);
      } else {
        const id = uncachedIds[uncachedIndex++];
        const evidence = evidenceMap.get(id) || null;
        results.push(evidence);
      }
    }

    return results;
  }

  /**
   * Batch load claims by IDs
   */
  async loadClaims(ids: string[]): Promise<Array<any | null>> {
    // Deduplicate IDs
    const uniqueIds = Array.from(new Set(ids));
    
    // Check cache first
    const cached: Array<any | null> = [];
    const uncachedIds: string[] = [];

    for (const id of ids) {
      const cachedPromise = this.claimCache.get(id);
      if (cachedPromise) {
        cached.push(await cachedPromise);
      } else {
        cached.push(null);
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length === 0) {
      return cached;
    }

    // Batch load uncached claims
    const claimRecords = await db.claim.findMany({
      where: { id: { in: uncachedIds } },
    });

    // Create a map for quick lookup
    const claimMap = new Map(claimRecords.map((c) => [c.id, c]));

    // Fill in results
    const results: Array<any | null> = [];
    let uncachedIndex = 0;

    for (let i = 0; i < ids.length; i++) {
      if (cached[i] !== null) {
        results.push(cached[i]);
      } else {
        const id = uncachedIds[uncachedIndex++];
        const claim = claimMap.get(id) || null;
        results.push(claim);
      }
    }

    return results;
  }

  /**
   * Batch load evidence for claims (N+1 prevention)
   */
  async loadEvidenceForClaims(claimIds: string[]): Promise<Map<string, any[]>> {
    const uniqueClaimIds = Array.from(new Set(claimIds));
    
    // Load all claim-evidence relationships in one query
    const claimEvidence = await db.claimEvidence.findMany({
      where: { claimId: { in: uniqueClaimIds } },
      include: { evidence: true },
    });

    // Group by claim ID
    const evidenceMap = new Map<string, any[]>();
    for (const ce of claimEvidence) {
      if (!evidenceMap.has(ce.claimId)) {
        evidenceMap.set(ce.claimId, []);
      }
      evidenceMap.get(ce.claimId)!.push(ce.evidence);
    }

    // Ensure all claim IDs have an entry (even if empty)
    for (const claimId of uniqueClaimIds) {
      if (!evidenceMap.has(claimId)) {
        evidenceMap.set(claimId, []);
      }
    }

    return evidenceMap;
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.evidenceCache.clear();
    this.claimCache.clear();
  }
}
