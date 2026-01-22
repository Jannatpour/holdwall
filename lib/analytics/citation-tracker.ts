/**
 * Citation Tracker
 * 
 * Tracks citations across all AI answer engines to measure
 * citation capture rate and narrative control.
 */

import { AIAnswerScraper, AIAnswer } from "../monitoring/ai-answer-scraper";

export interface Citation {
  source: string; // URL of cited source
  engine: string; // AI engine that cited
  query: string; // Query that triggered citation
  timestamp: string;
  context?: string; // Context in which cited
}

export interface CitationMetrics {
  totalCitations: number;
  uniqueSources: number;
  byEngine: Record<string, number>;
  bySource: Record<string, number>;
  citationRate: number; // Citations per query
  topSources: Array<{
    source: string;
    count: number;
  }>;
}

export class CitationTracker {
  private citations: Citation[] = [];
  private queries: Map<string, string> = new Map(); // queryId -> query

  /**
   * Track citation from AI answer
   */
  trackCitation(
    answer: AIAnswer,
    queryId: string
  ): Citation[] {
    const newCitations: Citation[] = [];

    if (answer.citations) {
      for (const citation of answer.citations) {
        const citationObj: Citation = {
          source: citation.url,
          engine: answer.engine,
          query: this.queries.get(queryId) || answer.query,
          timestamp: answer.timestamp,
          context: citation.snippet,
        };

        this.citations.push(citationObj);
        newCitations.push(citationObj);
      }
    }

    return newCitations;
  }

  /**
   * Register query
   */
  registerQuery(queryId: string, query: string): void {
    this.queries.set(queryId, query);
  }

  /**
   * Calculate citation metrics
   */
  calculateMetrics(
    timeWindow?: { start: string; end: string }
  ): CitationMetrics {
    let filtered = this.citations;

    if (timeWindow) {
      filtered = this.citations.filter(c => {
        const time = new Date(c.timestamp).getTime();
        return (
          time >= new Date(timeWindow.start).getTime() &&
          time <= new Date(timeWindow.end).getTime()
        );
      });
    }

    // Count by engine
    const byEngine: Record<string, number> = {};
    for (const citation of filtered) {
      byEngine[citation.engine] = (byEngine[citation.engine] || 0) + 1;
    }

    // Count by source
    const bySource: Record<string, number> = {};
    for (const citation of filtered) {
      bySource[citation.source] = (bySource[citation.source] || 0) + 1;
    }

    // Top sources
    const topSources = Object.entries(bySource)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Citation rate
    const uniqueQueries = new Set(filtered.map(c => c.query)).size;
    const citationRate = uniqueQueries > 0 ? filtered.length / uniqueQueries : 0;

    return {
      totalCitations: filtered.length,
      uniqueSources: Object.keys(bySource).length,
      byEngine,
      bySource,
      citationRate,
      topSources,
    };
  }

  /**
   * Get citations for source
   */
  getCitationsForSource(sourceUrl: string): Citation[] {
    return this.citations.filter(c => c.source === sourceUrl);
  }

  /**
   * Get citations for engine
   */
  getCitationsForEngine(engine: string): Citation[] {
    return this.citations.filter(c => c.engine === engine);
  }

  /**
   * Calculate citation capture rate
   */
  calculateCaptureRate(
    targetSources: string[],
    timeWindow?: { start: string; end: string }
  ): number {
    const metrics = this.calculateMetrics(timeWindow);
    const targetCitations = this.citations.filter(c => targetSources.includes(c.source));

    if (metrics.totalCitations === 0) {
      return 0;
    }

    return targetCitations.length / metrics.totalCitations;
  }
}
