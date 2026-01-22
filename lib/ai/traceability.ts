/**
 * Traceability System
 * 
 * Link evaluation scores to exact prompt, dataset, and model versions
 * for auditability and reproducibility.
 */

export interface Trace {
  id: string;
  evaluationId: string;
  prompt: {
    id: string;
    version: string;
    content: string;
  };
  model: {
    name: string;
    version: string;
  };
  dataset?: {
    id: string;
    version: string;
  };
  timestamp: string;
  scores: Record<string, number>;
  metadata: Record<string, unknown>;
}

export class Traceability {
  private traces: Map<string, Trace> = new Map();

  /**
   * Create trace
   */
  createTrace(
    evaluationId: string,
    prompt: { id: string; version: string; content: string },
    model: { name: string; version: string },
    scores: Record<string, number>,
    options?: {
      dataset?: { id: string; version: string };
      metadata?: Record<string, unknown>;
    }
  ): Trace {
    const trace: Trace = {
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
  getTrace(traceId: string): Trace | null {
    return this.traces.get(traceId) || null;
  }

  /**
   * Get traces for evaluation
   */
  getTracesForEvaluation(evaluationId: string): Trace[] {
    return Array.from(this.traces.values())
      .filter(t => t.evaluationId === evaluationId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get traces for model
   */
  getTracesForModel(modelName: string, modelVersion?: string): Trace[] {
    return Array.from(this.traces.values())
      .filter(t => 
        t.model.name === modelName &&
        (!modelVersion || t.model.version === modelVersion)
      );
  }

  /**
   * Get trace history
   */
  getTraceHistory(
    filters?: {
      modelName?: string;
      promptId?: string;
      startTime?: string;
      endTime?: string;
    }
  ): Trace[] {
    let filtered = Array.from(this.traces.values());

    if (filters?.modelName) {
      filtered = filtered.filter(t => t.model.name === filters.modelName);
    }

    if (filters?.promptId) {
      filtered = filtered.filter(t => t.prompt.id === filters.promptId);
    }

    if (filters?.startTime) {
      filtered = filtered.filter(t => t.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(t => t.timestamp <= filters.endTime!);
    }

    return filtered.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
}
