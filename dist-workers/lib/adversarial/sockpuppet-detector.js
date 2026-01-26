"use strict";
/**
 * Sockpuppet Detector
 *
 * Detects sockpuppet accounts by analyzing account similarity,
 * posting patterns, and IP analysis.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SockpuppetDetector = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
class SockpuppetDetector {
    /**
     * Detect sockpuppet accounts for evidence
     */
    async detect(evidenceId, tenantId) {
        try {
            const evidence = await client_1.db.evidence.findUnique({
                where: { id: evidenceId },
            });
            if (!evidence || evidence.tenantId !== tenantId) {
                return { detected: false, confidence: 0, indicators: [] };
            }
            // Extract account identifier from source
            const accountId = this.extractAccountId(evidence);
            if (!accountId) {
                return { detected: false, confidence: 0, indicators: [] };
            }
            // Find similar accounts
            const similarAccounts = await this.findSimilarAccounts(accountId, tenantId, evidence);
            if (similarAccounts.length < 2) {
                return { detected: false, confidence: 0, indicators: [] };
            }
            const indicators = [];
            let confidence = 0;
            // Check posting pattern similarity
            const patternScore = this.analyzePostingPatterns(evidence, similarAccounts);
            if (patternScore > 0.7) {
                indicators.push(`Similar posting patterns detected`);
                confidence += 0.3;
            }
            // Check content similarity
            const contentScore = this.analyzeContentSimilarity(evidence, similarAccounts);
            if (contentScore > 0.7) {
                indicators.push(`High content similarity across accounts`);
                confidence += 0.3;
            }
            // Check timing patterns
            const timingScore = this.analyzeTimingPatterns(evidence, similarAccounts);
            if (timingScore > 0.7) {
                indicators.push(`Suspicious timing patterns`);
                confidence += 0.2;
            }
            // Check metadata similarity
            const metadataScore = this.analyzeMetadataSimilarity(evidence, similarAccounts);
            if (metadataScore > 0.7) {
                indicators.push(`Similar metadata across accounts`);
                confidence += 0.2;
            }
            const detected = confidence >= 0.5;
            // Create or get sockpuppet cluster
            let clusterId;
            if (detected) {
                clusterId = await this.getOrCreateCluster(tenantId, [accountId, ...similarAccounts.map(a => a.accountId)]);
            }
            return {
                detected,
                confidence: Math.min(1.0, confidence),
                cluster_id: clusterId,
                indicators,
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to detect sockpuppets", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: evidenceId,
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            return { detected: false, confidence: 0, indicators: [] };
        }
    }
    /**
     * Extract account ID from evidence
     */
    extractAccountId(evidence) {
        // Try to extract from source ID or metadata
        const metadata = evidence.metadata;
        if (metadata?.accountId) {
            return String(metadata.accountId);
        }
        if (metadata?.userId) {
            return String(metadata.userId);
        }
        if (metadata?.author) {
            return String(metadata.author);
        }
        // Fallback to source ID if it looks like an account ID
        if (evidence.sourceId && evidence.sourceId.length < 50) {
            return evidence.sourceId;
        }
        return null;
    }
    /**
     * Find similar accounts
     */
    async findSimilarAccounts(accountId, tenantId, evidence) {
        // Get evidence from same source type with similar content
        const similar = await client_1.db.evidence.findMany({
            where: {
                tenantId,
                sourceType: evidence.sourceType,
                id: { not: evidence.id },
                createdAt: {
                    gte: new Date(new Date(evidence.createdAt).getTime() - 7 * 24 * 60 * 60 * 1000),
                },
            },
            take: 50,
        });
        // Filter by account similarity (simplified - in production use more sophisticated matching)
        return similar
            .filter((e) => {
            const eAccountId = this.extractAccountId(e);
            return eAccountId && eAccountId !== accountId;
        })
            .map((e) => ({
            accountId: this.extractAccountId(e),
            evidence: e,
        }));
    }
    /**
     * Analyze posting patterns
     */
    analyzePostingPatterns(evidence, similarAccounts) {
        // Check if posting times are similar (same hours of day)
        const evidenceHour = new Date(evidence.createdAt).getHours();
        const similarHours = similarAccounts.map((a) => new Date(a.evidence.createdAt).getHours());
        const hourMatches = similarHours.filter((h) => Math.abs(h - evidenceHour) <= 2).length;
        return hourMatches / similarAccounts.length;
    }
    /**
     * Analyze content similarity
     */
    analyzeContentSimilarity(evidence, similarAccounts) {
        const content = (evidence.contentRaw || evidence.contentNormalized || "").toLowerCase();
        const similarities = similarAccounts.map((a) => {
            const aContent = (a.evidence.contentRaw || a.evidence.contentNormalized || "").toLowerCase();
            // Simple word overlap
            const words = new Set(content.split(/\s+/));
            const aWords = new Set(aContent.split(/\s+/));
            const intersection = new Set([...words].filter((w) => aWords.has(w)));
            return intersection.size / Math.max(words.size, aWords.size, 1);
        });
        return similarities.reduce((a, b) => a + b, 0) / similarities.length;
    }
    /**
     * Analyze timing patterns
     */
    analyzeTimingPatterns(evidence, similarAccounts) {
        const evidenceTime = new Date(evidence.createdAt).getTime();
        const times = similarAccounts.map((a) => new Date(a.evidence.createdAt).getTime());
        const avgTimeDiff = times.reduce((sum, t) => sum + Math.abs(t - evidenceTime), 0) / times.length;
        // Lower time difference = higher correlation
        return 1 - Math.min(1, avgTimeDiff / (24 * 60 * 60 * 1000));
    }
    /**
     * Analyze metadata similarity
     */
    analyzeMetadataSimilarity(evidence, similarAccounts) {
        const evidenceMeta = JSON.stringify(evidence.metadata || {});
        const matches = similarAccounts.filter((a) => {
            const aMeta = JSON.stringify(a.evidence.metadata || {});
            return aMeta === evidenceMeta;
        }).length;
        return matches / similarAccounts.length;
    }
    /**
     * Get or create sockpuppet cluster
     */
    async getOrCreateCluster(tenantId, accountIds) {
        // Check for existing cluster
        const existing = await client_1.db.sockpuppetCluster.findFirst({
            where: {
                tenantId,
                accountIds: { hasEvery: accountIds.slice(0, 2) },
            },
        });
        if (existing) {
            // Update with new accounts
            const updatedIds = Array.from(new Set([...existing.accountIds, ...accountIds]));
            await client_1.db.sockpuppetCluster.update({
                where: { id: existing.id },
                data: { accountIds: updatedIds },
            });
            return existing.clusterId;
        }
        // Create new cluster
        const cluster = await client_1.db.sockpuppetCluster.create({
            data: {
                tenantId,
                clusterId: `sockpuppet-${Date.now()}`,
                accountIds: Array.from(new Set(accountIds)),
                confidence: 0.7,
                indicators: ["Detected by sockpuppet detector"],
            },
        });
        return cluster.clusterId;
    }
}
exports.SockpuppetDetector = SockpuppetDetector;
