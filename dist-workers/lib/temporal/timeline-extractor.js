"use strict";
/**
 * Timeline Extractor
 *
 * Extracts timelines (who/what/when) from evidence to answer "what changed" credibly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimelineExtractor = void 0;
const client_1 = require("@/lib/db/client");
const logger_1 = require("@/lib/logging/logger");
class TimelineExtractor {
    /**
     * Extract timeline from evidence
     */
    async extractTimeline(evidenceIds, tenantId) {
        try {
            const evidence = await client_1.db.evidence.findMany({
                where: {
                    id: { in: evidenceIds },
                    tenantId,
                },
                orderBy: { createdAt: "asc" },
            });
            if (evidence.length === 0) {
                return {
                    tenant_id: tenantId,
                    events: [],
                    entities: [],
                    date_range: {
                        start: new Date().toISOString(),
                        end: new Date().toISOString(),
                    },
                    summary: {
                        total_events: 0,
                        unique_actors: 0,
                        key_events: [],
                    },
                };
            }
            const events = [];
            const entities = new Set();
            for (const ev of evidence) {
                const timelineEvent = this.extractEventFromEvidence(ev);
                if (timelineEvent) {
                    events.push(timelineEvent);
                    if (timelineEvent.who) {
                        entities.add(timelineEvent.who);
                    }
                }
            }
            // Sort by timestamp
            events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            // Get date range
            const timestamps = events.map((e) => new Date(e.timestamp).getTime());
            const startDate = new Date(Math.min(...timestamps)).toISOString();
            const endDate = new Date(Math.max(...timestamps)).toISOString();
            // Identify key events (high confidence, significant actions)
            const keyEvents = events
                .filter((e) => e.confidence >= 0.7)
                .slice(0, 10);
            return {
                tenant_id: tenantId,
                events,
                entities: Array.from(entities),
                date_range: {
                    start: startDate,
                    end: endDate,
                },
                summary: {
                    total_events: events.length,
                    unique_actors: entities.size,
                    key_events: keyEvents,
                },
            };
        }
        catch (error) {
            logger_1.logger.error("Failed to extract timeline", {
                error: error instanceof Error ? error.message : String(error),
                tenant_id: tenantId,
                stack: error instanceof Error ? error.stack : undefined,
            });
            throw error;
        }
    }
    /**
     * Extract event from evidence
     */
    extractEventFromEvidence(evidence) {
        try {
            const content = evidence.contentRaw || evidence.contentNormalized || "";
            if (!content.trim()) {
                return null;
            }
            // Extract who (actor)
            const who = this.extractActor(content, evidence);
            // Extract what (action/event)
            const what = this.extractAction(content);
            // Extract when (timestamp)
            const when = evidence.collectedAt.toISOString();
            // Calculate confidence based on evidence quality
            const confidence = this.calculateConfidence(evidence, content);
            return {
                timestamp: evidence.collectedAt.toISOString(),
                who,
                what,
                when,
                evidence_id: evidence.id,
                confidence,
                metadata: {
                    source_type: evidence.sourceType,
                    source_id: evidence.sourceId,
                },
            };
        }
        catch (error) {
            logger_1.logger.warn("Failed to extract event from evidence", {
                error: error instanceof Error ? error.message : String(error),
                evidence_id: evidence.id,
            });
            return null;
        }
    }
    /**
     * Extract actor from content
     */
    extractActor(content, evidence) {
        // Try metadata first
        const metadata = evidence.metadata;
        if (metadata?.author) {
            return String(metadata.author);
        }
        if (metadata?.userId) {
            return String(metadata.userId);
        }
        if (metadata?.accountId) {
            return String(metadata.accountId);
        }
        // Try source
        if (evidence.collectedBy && evidence.collectedBy !== "system") {
            return evidence.collectedBy;
        }
        // Extract from content (simplified - in production use NER)
        const authorMatch = content.match(/(?:by|from|author|posted by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
        if (authorMatch) {
            return authorMatch[1];
        }
        return "unknown";
    }
    /**
     * Extract action from content
     */
    extractAction(content) {
        // Extract first sentence or key phrase (simplified)
        const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
        if (sentences.length > 0) {
            return sentences[0].trim().substring(0, 200);
        }
        return content.substring(0, 200);
    }
    /**
     * Calculate confidence score
     */
    calculateConfidence(evidence, content) {
        let confidence = 0.5; // Base confidence
        // Higher confidence for verified sources
        if (evidence.signatureAlgorithm && evidence.signatureValue) {
            confidence += 0.2;
        }
        // Higher confidence for longer content
        if (content.length > 100) {
            confidence += 0.1;
        }
        // Higher confidence for recent evidence
        const age = Date.now() - new Date(evidence.createdAt).getTime();
        const ageDays = age / (24 * 60 * 60 * 1000);
        if (ageDays < 7) {
            confidence += 0.1;
        }
        else if (ageDays < 30) {
            confidence += 0.05;
        }
        return Math.min(1.0, confidence);
    }
}
exports.TimelineExtractor = TimelineExtractor;
