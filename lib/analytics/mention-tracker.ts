/**
 * Mention Volume Tracker
 * 
 * Tracks mention volume across platforms to identify trends
 * and measure narrative impact.
 */

export interface MentionVolume {
  platform: string;
  date: string;
  count: number;
  sentiment: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

export interface VolumeMetrics {
  platform: string;
  totalMentions: number;
  averageDaily: number;
  peakDay: string;
  trend: "increasing" | "decreasing" | "stable";
  growthRate: number; // Percentage
}

export class MentionTracker {
  private volumes: Map<string, MentionVolume[]> = new Map(); // platform -> volumes

  /**
   * Record mention volume
   */
  recordVolume(volume: MentionVolume): void {
    if (!this.volumes.has(volume.platform)) {
      this.volumes.set(volume.platform, []);
    }

    this.volumes.get(volume.platform)!.push(volume);
  }

  /**
   * Calculate metrics for platform
   */
  calculateMetrics(
    platform: string,
    timeWindow?: { start: string; end: string }
  ): VolumeMetrics {
    let volumes = this.volumes.get(platform) || [];

    if (timeWindow) {
      volumes = volumes.filter(v => {
        const date = new Date(v.date).getTime();
        return (
          date >= new Date(timeWindow.start).getTime() &&
          date <= new Date(timeWindow.end).getTime()
        );
      });
    }

    if (volumes.length === 0) {
      return {
        platform,
        totalMentions: 0,
        averageDaily: 0,
        peakDay: "",
        trend: "stable",
        growthRate: 0,
      };
    }

    const totalMentions = volumes.reduce((sum, v) => sum + v.count, 0);
    const averageDaily = totalMentions / volumes.length;

    // Find peak day
    const peakDay = volumes.reduce((max, v) => 
      v.count > max.count ? v : max
    ).date;

    // Calculate trend
    const recent = volumes.slice(-Math.ceil(volumes.length * 0.3));
    const older = volumes.slice(0, Math.ceil(volumes.length * 0.3));

    const recentAvg = recent.reduce((sum, v) => sum + v.count, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v.count, 0) / older.length;

    let trend: "increasing" | "decreasing" | "stable";
    let growthRate: number;

    if (recentAvg > olderAvg * 1.2) {
      trend = "increasing";
      growthRate = ((recentAvg - olderAvg) / olderAvg) * 100;
    } else if (recentAvg < olderAvg * 0.8) {
      trend = "decreasing";
      growthRate = ((olderAvg - recentAvg) / olderAvg) * 100;
    } else {
      trend = "stable";
      growthRate = 0;
    }

    return {
      platform,
      totalMentions,
      averageDaily,
      peakDay,
      trend,
      growthRate,
    };
  }

  /**
   * Get volumes for platform
   */
  getVolumes(platform: string): MentionVolume[] {
    return this.volumes.get(platform) || [];
  }
}
