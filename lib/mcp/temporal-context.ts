/**
 * Temporal Context Management
 * 
 * Interaction history across agents for maintaining context
 * and enabling coherent multi-turn conversations.
 */

export interface TemporalContext {
  sessionId: string;
  interactions: Array<{
    timestamp: string;
    agent: string;
    input: string;
    output: string;
    metadata?: Record<string, unknown>;
  }>;
  summary?: string;
}

export class TemporalContextManager {
  private contexts: Map<string, TemporalContext> = new Map();
  private maxInteractions: number = 100;

  /**
   * Get or create temporal context
   */
  getContext(sessionId: string): TemporalContext {
    if (!this.contexts.has(sessionId)) {
      this.contexts.set(sessionId, {
        sessionId,
        interactions: [],
      });
    }

    return this.contexts.get(sessionId)!;
  }

  /**
   * Add interaction to context
   */
  addInteraction(
    sessionId: string,
    agent: string,
    input: string,
    output: string,
    metadata?: Record<string, unknown>
  ): void {
    const context = this.getContext(sessionId);

    context.interactions.push({
      timestamp: new Date().toISOString(),
      agent,
      input,
      output,
      metadata,
    });

    // Limit interactions
    if (context.interactions.length > this.maxInteractions) {
      context.interactions = context.interactions.slice(-this.maxInteractions);
    }

    // Update summary periodically
    if (context.interactions.length % 10 === 0) {
      context.summary = this.generateSummary(context);
    }
  }

  /**
   * Get recent interactions
   */
  getRecentInteractions(
    sessionId: string,
    count: number = 10
  ): TemporalContext["interactions"] {
    const context = this.getContext(sessionId);
    return context.interactions.slice(-count);
  }

  /**
   * Generate summary
   */
  private generateSummary(context: TemporalContext): string {
    // Simple summary (in production, use LLM)
    return `Session with ${context.interactions.length} interactions. Latest: ${context.interactions[context.interactions.length - 1]?.input || ""}`;
  }

  /**
   * Clear context
   */
  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }
}
