/**
 * Performance Learner
 * 
 * Reinforcement learning system that learns what works and optimizes
 * publishing strategies based on performance data.
 */

export interface PublishingAction {
  id: string;
  type: "publish" | "schedule" | "adapt";
  platform: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceReward {
  actionId: string;
  reward: number; // -1 to 1
  metrics: {
    impressions?: number;
    engagements?: number;
    citations?: number;
    sentiment?: number;
  };
  timestamp: string;
}

export interface LearnedStrategy {
  platform: string;
  optimalLength: number;
  optimalTiming: string; // Hour of day
  optimalHashtags: number;
  optimalTone: string;
  confidence: number; // 0-1
}

export class PerformanceLearner {
  private actions: PublishingAction[] = [];
  private rewards: Map<string, PerformanceReward> = new Map();
  private strategies: Map<string, LearnedStrategy> = new Map();

  /**
   * Record publishing action
   */
  recordAction(action: PublishingAction): void {
    this.actions.push(action);
  }

  /**
   * Record performance reward
   */
  recordReward(reward: PerformanceReward): void {
    this.rewards.set(reward.actionId, reward);
  }

  /**
   * Learn optimal strategy for platform
   */
  learnStrategy(platform: string): LearnedStrategy {
    // Get actions for this platform
    const platformActions = this.actions.filter(a => a.platform === platform);
    
    if (platformActions.length === 0) {
      // Return default strategy
      return this.getDefaultStrategy(platform);
    }

    // Analyze performance
    const successfulActions = platformActions
      .map(action => {
        const reward = this.rewards.get(action.id);
        return { action, reward };
      })
      .filter(item => item.reward && item.reward.reward > 0)
      .sort((a, b) => (b.reward?.reward || 0) - (a.reward?.reward || 0));

    if (successfulActions.length === 0) {
      return this.getDefaultStrategy(platform);
    }

    // Extract patterns from successful actions
    const topActions = successfulActions.slice(0, Math.min(10, successfulActions.length));

    // Calculate optimal length
    const lengths = topActions.map(item => item.action.content.length);
    const optimalLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

    // Calculate optimal timing
    const timings = topActions.map(item => {
      const date = new Date(item.action.timestamp);
      return date.getHours();
    });
    const optimalHour = this.mode(timings);

    // Extract hashtag count (simplified)
    const hashtagCounts = topActions.map(item => {
      const matches = item.action.content.match(/#\w+/g);
      return matches ? matches.length : 0;
    });
    const optimalHashtags = Math.round(
      hashtagCounts.reduce((a, b) => a + b, 0) / hashtagCounts.length
    );

    // Determine optimal tone (simplified)
    const optimalTone = "professional"; // Would analyze content tone

    // Calculate confidence
    const confidence = Math.min(0.9, successfulActions.length / 20);

    const strategy: LearnedStrategy = {
      platform,
      optimalLength: Math.round(optimalLength),
      optimalTiming: optimalHour.toString(),
      optimalHashtags,
      optimalTone,
      confidence,
    };

    this.strategies.set(platform, strategy);
    return strategy;
  }

  /**
   * Get mode of array
   */
  private mode(numbers: number[]): number {
    const counts = new Map<number, number>();
    for (const num of numbers) {
      counts.set(num, (counts.get(num) || 0) + 1);
    }

    let maxCount = 0;
    let mode = numbers[0];

    for (const [num, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mode = num;
      }
    }

    return mode;
  }

  /**
   * Get default strategy
   */
  private getDefaultStrategy(platform: string): LearnedStrategy {
    const defaults: Record<string, Partial<LearnedStrategy>> = {
      twitter: { optimalLength: 240, optimalHashtags: 2 },
      linkedin: { optimalLength: 1500, optimalHashtags: 5 },
      facebook: { optimalLength: 250, optimalHashtags: 3 },
      medium: { optimalLength: 1500, optimalHashtags: 0 },
      reddit: { optimalLength: 500, optimalHashtags: 0 },
    };

    return {
      platform,
      optimalLength: defaults[platform]?.optimalLength || 500,
      optimalTiming: "10",
      optimalHashtags: defaults[platform]?.optimalHashtags || 0,
      optimalTone: "professional",
      confidence: 0.5,
    };
  }

  /**
   * Get learned strategy for platform
   */
  getStrategy(platform: string): LearnedStrategy {
    if (this.strategies.has(platform)) {
      return this.strategies.get(platform)!;
    }

    // Learn if not already learned
    return this.learnStrategy(platform);
  }

  /**
   * Optimize content based on learned strategy
   */
  optimizeContent(
    content: string,
    platform: string
  ): string {
    const strategy = this.getStrategy(platform);
    let optimized = content;

    // Adjust length
    if (optimized.length > strategy.optimalLength) {
      optimized = optimized.substring(0, strategy.optimalLength - 3) + "...";
    }

    // Add hashtags if needed
    if (strategy.optimalHashtags > 0) {
      const hashtagCount = (optimized.match(/#\w+/g) || []).length;
      if (hashtagCount < strategy.optimalHashtags) {
        // Would add relevant hashtags
      }
    }

    return optimized;
  }

  /**
   * Get optimal timing based on learned strategy
   */
  getOptimalTiming(platform: string): string {
    const strategy = this.getStrategy(platform);
    const now = new Date();
    now.setHours(parseInt(strategy.optimalTiming), 0, 0, 0);
    return now.toISOString();
  }
}
