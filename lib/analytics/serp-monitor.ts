/**
 * SERP Monitor
 * 
 * Monitors search engine result positions for brand-related queries
 * to track SEO/AEO effectiveness.
 */

export interface SERPResult {
  query: string;
  position: number; // 1-10 (top 10)
  url: string;
  title: string;
  snippet: string;
  timestamp: string;
}

export interface SERPMetrics {
  query: string;
  averagePosition: number;
  top10Count: number;
  positionHistory: Array<{
    date: string;
    position: number;
  }>;
  trend: "improving" | "declining" | "stable";
}

export class SERPMonitor {
  private results: Map<string, SERPResult[]> = new Map(); // query -> results over time

  /**
   * Record SERP result
   */
  recordResult(query: string, result: SERPResult): void {
    if (!this.results.has(query)) {
      this.results.set(query, []);
    }

    this.results.get(query)!.push(result);
  }

  /**
   * Get current position for query
   */
  getCurrentPosition(query: string, targetUrl: string): number | null {
    const queryResults = this.results.get(query);
    if (!queryResults || queryResults.length === 0) {
      return null;
    }

    // Get most recent result
    const latest = queryResults
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

    // Find position of target URL
    const index = latest.url === targetUrl ? 0 : -1;
    return index >= 0 ? latest.position : null;
  }

  /**
   * Calculate metrics for query
   */
  calculateMetrics(query: string, targetUrl: string): SERPMetrics {
    const queryResults = this.results.get(query) || [];

    if (queryResults.length === 0) {
      return {
        query,
        averagePosition: 0,
        top10Count: 0,
        positionHistory: [],
        trend: "stable",
      };
    }

    // Filter for target URL
    const targetResults = queryResults.filter(r => r.url === targetUrl);

    if (targetResults.length === 0) {
      return {
        query,
        averagePosition: 0,
        top10Count: 0,
        positionHistory: [],
        trend: "stable",
      };
    }

    // Calculate average position
    const averagePosition = targetResults.reduce((sum, r) => sum + r.position, 0) / targetResults.length;

    // Count top 10 appearances
    const top10Count = targetResults.filter(r => r.position <= 10).length;

    // Position history
    const positionHistory = targetResults
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map(r => ({
        date: r.timestamp.split("T")[0],
        position: r.position,
      }));

    // Determine trend
    let trend: "improving" | "declining" | "stable";
    if (positionHistory.length >= 2) {
      const recent = positionHistory.slice(-Math.ceil(positionHistory.length * 0.3));
      const older = positionHistory.slice(0, Math.ceil(positionHistory.length * 0.3));

      const recentAvg = recent.reduce((sum, h) => sum + h.position, 0) / recent.length;
      const olderAvg = older.reduce((sum, h) => sum + h.position, 0) / older.length;

      if (recentAvg < olderAvg - 2) {
        trend = "improving";
      } else if (recentAvg > olderAvg + 2) {
        trend = "declining";
      } else {
        trend = "stable";
      }
    } else {
      trend = "stable";
    }

    return {
      query,
      averagePosition,
      top10Count,
      positionHistory,
      trend,
    };
  }

  /**
   * Get all tracked queries
   */
  getTrackedQueries(): string[] {
    return Array.from(this.results.keys());
  }
}
