/**
 * Temporal Tracker
 * 
 * Tracks narrative evolution over time to identify trends, shifts, and patterns.
 */

import { PAIData } from "./pai-aggregator";

export interface TemporalSnapshot {
  timestamp: string;
  mentions: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  topNarratives: Array<{
    narrative: string;
    frequency: number;
    sentiment: "positive" | "negative" | "neutral" | "mixed";
  }>;
  platforms: Record<string, number>;
}

export interface TemporalAnalysis {
  brandName: string;
  period: {
    start: string;
    end: string;
  };
  snapshots: TemporalSnapshot[];
  trends: {
    narrative: string;
    trend: "increasing" | "decreasing" | "stable" | "emerging";
    velocity: number;
    confidence: number;
  }[];
  shifts: Array<{
    timestamp: string;
    type: "sentiment" | "volume" | "narrative";
    description: string;
    magnitude: number;
  }>;
}

export class TemporalTracker {
  private snapshots: Map<string, TemporalSnapshot[]> = new Map(); // brand -> snapshots

  /**
   * Create snapshot from data
   */
  createSnapshot(
    brandName: string,
    data: PAIData[],
    timestamp: string = new Date().toISOString()
  ): TemporalSnapshot {
    // Group by time window (hourly)
    const snapshot: TemporalSnapshot = {
      timestamp,
      mentions: data.length,
      sentiment: {
        positive: 0,
        negative: 0,
        neutral: 0,
        mixed: 0,
      },
      topNarratives: [],
      platforms: {},
    };

    // Analyze sentiment
    for (const item of data) {
      const sentiment = this.detectSentiment(item.content);
      snapshot.sentiment[sentiment]++;

      // Track platforms
      const platform = item.metadata.platform || item.source.type || "unknown";
      snapshot.platforms[platform] = (snapshot.platforms[platform] || 0) + 1;
    }

    // Extract top narratives
    snapshot.topNarratives = this.extractTopNarratives(data);

    // Store snapshot
    if (!this.snapshots.has(brandName)) {
      this.snapshots.set(brandName, []);
    }
    this.snapshots.get(brandName)!.push(snapshot);

    return snapshot;
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(text: string): "positive" | "negative" | "neutral" | "mixed" {
    const lower = text.toLowerCase();
    
    const positiveWords = ["good", "great", "excellent", "amazing", "love", "best"];
    const negativeWords = ["bad", "terrible", "awful", "hate", "worst", "scam"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount && positiveCount > 0) {
      return "positive";
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      return "negative";
    } else if (positiveCount > 0 && negativeCount > 0) {
      return "mixed";
    } else {
      return "neutral";
    }
  }

  /**
   * Extract top narratives
   */
  private extractTopNarratives(data: PAIData[]): TemporalSnapshot["topNarratives"] {
    const narrativeCounts = new Map<string, { frequency: number; sentiment: Map<string, number> }>();

    for (const item of data) {
      // Extract key phrases (simplified)
      const phrases = this.extractKeyPhrases(item.content);
      const sentiment = this.detectSentiment(item.content);

      for (const phrase of phrases) {
        if (!narrativeCounts.has(phrase)) {
          narrativeCounts.set(phrase, {
            frequency: 0,
            sentiment: new Map(),
          });
        }

        const narrative = narrativeCounts.get(phrase)!;
        narrative.frequency++;
        narrative.sentiment.set(sentiment, (narrative.sentiment.get(sentiment) || 0) + 1);
      }
    }

    // Convert to array and determine dominant sentiment
    return Array.from(narrativeCounts.entries())
      .map(([narrative, info]) => {
        // Find dominant sentiment
        let dominantSentiment: "positive" | "negative" | "neutral" | "mixed" = "neutral";
        let maxCount = 0;

        for (const [sent, count] of info.sentiment.entries()) {
          if (count > maxCount) {
            maxCount = count;
            dominantSentiment = sent as any;
          }
        }

        return {
          narrative,
          frequency: info.frequency,
          sentiment: dominantSentiment,
        };
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  }

  /**
   * Extract key phrases
   */
  private extractKeyPhrases(text: string): string[] {
    // Simple phrase extraction (in production, use NLP)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const phrases: string[] = [];

    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      // Extract 3-5 word phrases
      for (let i = 0; i <= words.length - 3; i++) {
        const phrase = words.slice(i, Math.min(i + 5, words.length)).join(" ");
        if (phrase.length > 15 && phrase.length < 100) {
          phrases.push(phrase);
        }
      }
    }

    return phrases;
  }

  /**
   * Analyze temporal trends
   */
  analyzeTemporal(
    brandName: string,
    period?: { start: string; end: string }
  ): TemporalAnalysis {
    const snapshots = this.snapshots.get(brandName) || [];

    // Filter by period if provided
    let filteredSnapshots = snapshots;
    if (period) {
      filteredSnapshots = snapshots.filter(s => {
        const time = new Date(s.timestamp).getTime();
        return (
          time >= new Date(period.start).getTime() &&
          time <= new Date(period.end).getTime()
        );
      });
    }

    // Identify trends
    const trends = this.identifyTrends(filteredSnapshots);

    // Detect shifts
    const shifts = this.detectShifts(filteredSnapshots);

    return {
      brandName,
      period: period || {
        start: filteredSnapshots[0]?.timestamp || new Date().toISOString(),
        end: filteredSnapshots[filteredSnapshots.length - 1]?.timestamp || new Date().toISOString(),
      },
      snapshots: filteredSnapshots,
      trends,
      shifts,
    };
  }

  /**
   * Identify trends in narratives
   */
  private identifyTrends(
    snapshots: TemporalSnapshot[]
  ): TemporalAnalysis["trends"] {
    const trends: TemporalAnalysis["trends"] = [];
    const narrativeHistory = new Map<string, number[]>(); // narrative -> frequencies over time

    // Collect narrative frequencies over time
    for (const snapshot of snapshots) {
      for (const narrative of snapshot.topNarratives) {
        if (!narrativeHistory.has(narrative.narrative)) {
          narrativeHistory.set(narrative.narrative, []);
        }
        narrativeHistory.get(narrative.narrative)!.push(narrative.frequency);
      }
    }

    // Analyze each narrative's trend
    for (const [narrative, frequencies] of narrativeHistory.entries()) {
      if (frequencies.length < 2) continue;

      // Calculate trend
      const recent = frequencies.slice(-Math.ceil(frequencies.length * 0.3));
      const older = frequencies.slice(0, Math.ceil(frequencies.length * 0.3));

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

      let trend: "increasing" | "decreasing" | "stable" | "emerging";
      let velocity = 0;

      if (recentAvg > olderAvg * 1.3) {
        trend = "increasing";
        velocity = (recentAvg - olderAvg) / olderAvg;
      } else if (recentAvg < olderAvg * 0.7) {
        trend = "decreasing";
        velocity = (olderAvg - recentAvg) / olderAvg;
      } else if (olderAvg === 0 && recentAvg > 0) {
        trend = "emerging";
        velocity = recentAvg;
      } else {
        trend = "stable";
        velocity = 0;
      }

      trends.push({
        narrative,
        trend,
        velocity,
        confidence: Math.min(0.9, frequencies.length / 10),
      });
    }

    return trends.sort((a, b) => Math.abs(b.velocity) - Math.abs(a.velocity));
  }

  /**
   * Detect significant shifts
   */
  private detectShifts(
    snapshots: TemporalSnapshot[]
  ): TemporalAnalysis["shifts"] {
    const shifts: TemporalAnalysis["shifts"] = [];

    if (snapshots.length < 2) {
      return shifts;
    }

    // Detect sentiment shifts
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];

      // Sentiment shift
      const prevPositive = prev.sentiment.positive / prev.mentions;
      const currPositive = curr.sentiment.positive / curr.mentions;
      const sentimentDelta = currPositive - prevPositive;

      if (Math.abs(sentimentDelta) > 0.2) {
        shifts.push({
          timestamp: curr.timestamp,
          type: "sentiment",
          description: sentimentDelta > 0 
            ? "Sentiment shifted positive"
            : "Sentiment shifted negative",
          magnitude: Math.abs(sentimentDelta),
        });
      }

      // Volume shift
      const volumeDelta = (curr.mentions - prev.mentions) / prev.mentions;
      if (Math.abs(volumeDelta) > 0.5) {
        shifts.push({
          timestamp: curr.timestamp,
          type: "volume",
          description: volumeDelta > 0
            ? "Mention volume increased significantly"
            : "Mention volume decreased significantly",
          magnitude: Math.abs(volumeDelta),
        });
      }
    }

    return shifts;
  }

  /**
   * Get snapshots for a brand
   */
  getSnapshots(brandName: string): TemporalSnapshot[] {
    return this.snapshots.get(brandName) || [];
  }

  /**
   * Clear old snapshots (keep last N)
   */
  clearOldSnapshots(brandName: string, keepLast: number = 100): void {
    const snapshots = this.snapshots.get(brandName);
    if (snapshots && snapshots.length > keepLast) {
      const sorted = snapshots.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      this.snapshots.set(brandName, sorted.slice(0, keepLast));
    }
  }
}
