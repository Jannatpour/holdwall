/**
 * Cross-Platform Scheduler
 * 
 * Coordinates publishing across platforms for maximum impact
 * by optimizing timing and sequencing.
 */

import { TimingOptimizer } from "./timing-optimizer";
import { EngagementPredictor } from "./engagement-predictor";

export interface ScheduledPublish {
  id: string;
  platform: string;
  content: string;
  scheduledTime: string;
  status: "scheduled" | "published" | "cancelled";
  publishedAt?: string;
  engagement?: number;
}

export interface PublishingSchedule {
  content: string;
  publishes: ScheduledPublish[];
  strategy: "simultaneous" | "staggered" | "optimal";
  totalEngagement?: number;
}

export class Scheduler {
  private timingOptimizer: TimingOptimizer;
  private engagementPredictor: EngagementPredictor;
  private scheduled: Map<string, ScheduledPublish> = new Map();

  constructor() {
    this.timingOptimizer = new TimingOptimizer();
    this.engagementPredictor = new EngagementPredictor();
  }

  /**
   * Schedule content for multiple platforms
   */
  schedule(
    content: string,
    platforms: string[],
    strategy: "simultaneous" | "staggered" | "optimal" = "optimal"
  ): PublishingSchedule {
    const publishes: ScheduledPublish[] = [];

    if (strategy === "simultaneous") {
      // Publish to all platforms at the same time
      const time = new Date().toISOString();
      for (const platform of platforms) {
        publishes.push(this.createScheduledPublish(content, platform, time));
      }
    } else if (strategy === "staggered") {
      // Stagger by 1 hour
      let time = new Date();
      for (const platform of platforms) {
        publishes.push(this.createScheduledPublish(content, platform, time.toISOString()));
        time.setHours(time.getHours() + 1);
      }
    } else {
      // Optimal timing for each platform
      for (const platform of platforms) {
        const timing = this.timingOptimizer.getOptimalTiming(platform);
        publishes.push(this.createScheduledPublish(content, platform, timing.recommendedTime));
      }
    }

    // Calculate predicted total engagement
    const totalEngagement = publishes.reduce((sum, pub) => {
      const factors = this.extractFactors(pub.content, pub.platform, new Date(pub.scheduledTime));
      const prediction = this.engagementPredictor.predict(pub.platform, factors);
      return sum + prediction.predictedEngagement;
    }, 0);

    return {
      content,
      publishes,
      strategy,
      totalEngagement,
    };
  }

  /**
   * Create scheduled publish
   */
  private createScheduledPublish(
    content: string,
    platform: string,
    scheduledTime: string
  ): ScheduledPublish {
    const publish: ScheduledPublish = {
      id: crypto.randomUUID(),
      platform,
      content,
      scheduledTime,
      status: "scheduled",
    };

    this.scheduled.set(publish.id, publish);
    return publish;
  }

  /**
   * Extract factors from content and timing
   */
  private extractFactors(
    content: string,
    platform: string,
    time: Date
  ): {
    contentLength: number;
    hashtagCount: number;
    linkCount: number;
    sentiment: "positive" | "negative" | "neutral";
    timing: string;
    dayOfWeek: number;
    hourOfDay: number;
  } {
    return {
      contentLength: content.length,
      hashtagCount: (content.match(/#\w+/g) || []).length,
      linkCount: (content.match(/https?:\/\//g) || []).length,
      sentiment: this.detectSentiment(content),
      timing: time.toISOString(),
      dayOfWeek: time.getDay(),
      hourOfDay: time.getHours(),
    };
  }

  /**
   * Detect sentiment
   */
  private detectSentiment(content: string): "positive" | "negative" | "neutral" {
    const lower = content.toLowerCase();
    const positiveWords = ["good", "great", "excellent", "amazing"];
    const negativeWords = ["bad", "terrible", "awful", "problem"];

    const positiveCount = positiveWords.filter(w => lower.includes(w)).length;
    const negativeCount = negativeWords.filter(w => lower.includes(w)).length;

    if (positiveCount > negativeCount) {
      return "positive";
    } else if (negativeCount > positiveCount) {
      return "negative";
    } else {
      return "neutral";
    }
  }

  /**
   * Get scheduled publishes
   */
  getScheduled(): ScheduledPublish[] {
    return Array.from(this.scheduled.values())
      .filter(p => p.status === "scheduled")
      .sort((a, b) => 
        new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime()
      );
  }

  /**
   * Mark as published
   */
  markPublished(publishId: string, engagement?: number): void {
    const publish = this.scheduled.get(publishId);
    if (publish) {
      publish.status = "published";
      publish.publishedAt = new Date().toISOString();
      if (engagement !== undefined) {
        publish.engagement = engagement;
      }
    }
  }

  /**
   * Cancel scheduled publish
   */
  cancel(publishId: string): void {
    const publish = this.scheduled.get(publishId);
    if (publish) {
      publish.status = "cancelled";
    }
  }
}
