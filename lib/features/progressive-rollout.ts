/**
 * Progressive Rollout
 * 
 * Percentage-based rollout and canary deployments
 * Gradually increases feature availability
 */

import { featureFlags } from "./feature-flags";

export interface RolloutConfig {
  flag_id: string;
  stages: Array<{
    percentage: number; // 0-100
    duration_hours: number; // Hours to stay at this percentage
    conditions?: Record<string, unknown>;
  }>;
  current_stage: number;
  started_at: string;
}

export interface RolloutStatus {
  flag_id: string;
  current_percentage: number;
  stage: number;
  total_stages: number;
  next_stage_at?: string;
  status: "in_progress" | "completed" | "paused" | "rolled_back";
}

/**
 * Progressive Rollout Manager
 */
export class ProgressiveRolloutManager {
  private rollouts = new Map<string, RolloutConfig>();

  /**
   * Start progressive rollout
   */
  startRollout(config: RolloutConfig): void {
    this.rollouts.set(config.flag_id, config);
    this.updateRollout(config.flag_id);
  }

  /**
   * Update rollout percentage based on stages
   */
  updateRollout(flagId: string): void {
    const rollout = this.rollouts.get(flagId);
    if (!rollout) {
      return;
    }

    const now = new Date();
    const startedAt = new Date(rollout.started_at);
    let elapsedHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

    // Find current stage based on elapsed time
    let currentStage = 0;
    let cumulativeHours = 0;

    for (let i = 0; i < rollout.stages.length; i++) {
      cumulativeHours += rollout.stages[i].duration_hours;
      if (elapsedHours < cumulativeHours) {
        currentStage = i;
        break;
      }
      currentStage = i;
    }

    // If past all stages, use final stage
    if (elapsedHours >= cumulativeHours) {
      currentStage = rollout.stages.length - 1;
    }

    rollout.current_stage = currentStage;
    const currentPercentage = rollout.stages[currentStage].percentage;

    // Update feature flag
    const flag = featureFlags.getAllFlags().find(f => f.id === flagId);
    if (flag) {
      flag.rollout_percentage = currentPercentage;
    }

    // Schedule next update if not at final stage
    if (currentStage < rollout.stages.length - 1) {
      const nextStageHours = rollout.stages[currentStage + 1].duration_hours;
      const nextUpdate = new Date(now.getTime() + nextStageHours * 60 * 60 * 1000);
      // In production, would use a scheduler
      console.log(`[Rollout] ${flagId} will advance to stage ${currentStage + 1} at ${nextUpdate.toISOString()}`);
    }
  }

  /**
   * Get rollout status
   */
  getStatus(flagId: string): RolloutStatus | null {
    const rollout = this.rollouts.get(flagId);
    if (!rollout) {
      return null;
    }

    const currentStage = rollout.stages[rollout.current_stage];
    const isComplete = rollout.current_stage >= rollout.stages.length - 1;

    return {
      flag_id: flagId,
      current_percentage: currentStage.percentage,
      stage: rollout.current_stage,
      total_stages: rollout.stages.length,
      status: isComplete ? "completed" : "in_progress",
    };
  }

  /**
   * Pause rollout
   */
  pauseRollout(flagId: string): void {
    const rollout = this.rollouts.get(flagId);
    if (rollout) {
      // Mark as paused (in production, would update status)
      console.log(`[Rollout] ${flagId} paused`);
    }
  }

  /**
   * Rollback rollout
   */
  rollbackRollout(flagId: string): void {
    const rollout = this.rollouts.get(flagId);
    if (rollout) {
      // Set percentage to 0
      const flag = featureFlags.getAllFlags().find(f => f.id === flagId);
      if (flag) {
        flag.rollout_percentage = 0;
      }
      console.log(`[Rollout] ${flagId} rolled back`);
    }
  }
}

export const progressiveRollout = new ProgressiveRolloutManager();
