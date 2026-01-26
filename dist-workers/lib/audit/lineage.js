"use strict";
/**
 * Audit-first message/event lineage
 *
 * Tracks full audit trail of:
 * - ACP messages (agent communications)
 * - Events (domain events)
 * - Evidence references
 * - Policy checks
 * - Approvals
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineageBuilder = void 0;
/**
 * Lineage builder: reconstruct full chain of events/messages
 */
class LineageBuilder {
    constructor(auditLog) {
        this.auditLog = auditLog;
    }
    async buildLineage(correlation_id) {
        const entries = await this.auditLog.getLineage(correlation_id);
        // Build tree structure
        const rootEntries = entries.filter((e) => !e.causation_id);
        const childMap = new Map();
        for (const entry of entries) {
            if (entry.causation_id) {
                if (!childMap.has(entry.causation_id)) {
                    childMap.set(entry.causation_id, []);
                }
                childMap.get(entry.causation_id).push(entry);
            }
        }
        return {
            correlation_id,
            root_entries: rootEntries,
            child_map: Object.fromEntries(childMap),
            all_entries: entries,
            evidence_refs: Array.from(new Set(entries.flatMap((e) => e.evidence_refs))),
        };
    }
}
exports.LineageBuilder = LineageBuilder;
