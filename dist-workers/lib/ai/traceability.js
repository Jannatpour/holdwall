"use strict";
/**
 * Traceability System
 *
 * Link evaluation scores to exact prompt, dataset, and model versions
 * for auditability and reproducibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Traceability = void 0;
class Traceability {
    constructor() {
        this.traces = new Map();
    }
    /**
     * Create trace
     */
    createTrace(evaluationId, prompt, model, scores, options) {
        const trace = {
            id: crypto.randomUUID(),
            evaluationId,
            prompt,
            model,
            dataset: options?.dataset,
            timestamp: new Date().toISOString(),
            scores,
            metadata: options?.metadata || {},
        };
        this.traces.set(trace.id, trace);
        return trace;
    }
    /**
     * Get trace
     */
    getTrace(traceId) {
        return this.traces.get(traceId) || null;
    }
    /**
     * Get traces for evaluation
     */
    getTracesForEvaluation(evaluationId) {
        return Array.from(this.traces.values())
            .filter(t => t.evaluationId === evaluationId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    /**
     * Get traces for model
     */
    getTracesForModel(modelName, modelVersion) {
        return Array.from(this.traces.values())
            .filter(t => t.model.name === modelName &&
            (!modelVersion || t.model.version === modelVersion));
    }
    /**
     * Get trace history
     */
    getTraceHistory(filters) {
        let filtered = Array.from(this.traces.values());
        if (filters?.modelName) {
            filtered = filtered.filter(t => t.model.name === filters.modelName);
        }
        if (filters?.promptId) {
            filtered = filtered.filter(t => t.prompt.id === filters.promptId);
        }
        if (filters?.startTime) {
            filtered = filtered.filter(t => t.timestamp >= filters.startTime);
        }
        if (filters?.endTime) {
            filtered = filtered.filter(t => t.timestamp <= filters.endTime);
        }
        return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}
exports.Traceability = Traceability;
