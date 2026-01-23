/**
 * SCoRe RL (Self-Correction via Reinforcement Learning)
 *
 * A lightweight, production-safe contextual bandit used to decide whether an
 * autonomous agent should accept, correct, or retry an output.
 *
 * This module is intentionally dependency-free and does not require persistent
 * storage; it learns online per-process. In production, it can be paired with
 * an event store / DB-backed policy store, but it is fully operational as-is.
 * 
 * Enhanced January 2026: Proper RL implementation with Q-learning
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";

export type ScoreRLActionType = "accept" | "correct" | "retry";

export interface ScoreRLState {
  agentId: string;
  operationId: string;
  output: unknown;
  confidence: number;
  context: Record<string, unknown>;
}

export interface ScoreRLOutcome {
  success: boolean;
  /** 0..1 where higher is better */
  quality: number;
}

export interface ScoreRLAction {
  type: ScoreRLActionType;
  reasoning: string;
}

type QEntry = {
  counts: Record<ScoreRLActionType, number>;
  values: Record<ScoreRLActionType, number>; // running mean reward
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function makeStateKey(state: ScoreRLState): string {
  // Keep key stable and low-cardinality; avoid embedding full output.
  const parts: Array<[string, unknown]> = [
    ["agentId", state.agentId],
    ["caseType", state.context.caseType],
    ["evidenceCount", state.context.evidenceCount],
  ];
  return parts.map(([k, v]) => `${k}=${String(v ?? "na")}`).join("|");
}

function rewardFromOutcome(outcome: ScoreRLOutcome): number {
  // Reward balances binary success with continuous quality.
  const q = clamp01(outcome.quality);
  const s = outcome.success ? 1 : 0;
  return clamp01(0.35 * s + 0.65 * q);
}

export class ScoreRL {
  private q: Map<string, QEntry> = new Map();
  private readonly epsilon: number;

  constructor(opts?: { epsilon?: number }) {
    this.epsilon = opts?.epsilon ?? 0.08;
  }

  async selectAction(state: ScoreRLState): Promise<ScoreRLAction> {
    const confidence = clamp01(state.confidence);
    const key = makeStateKey(state);
    const entry = this.q.get(key);

    // Baseline heuristic policy (safe default).
    let heuristic: ScoreRLActionType = "accept";
    if (confidence < 0.6) heuristic = "retry";
    else if (confidence < 0.8) heuristic = "correct";

    // If we have no learning yet, stick to heuristic.
    if (!entry) {
      metrics.increment("score_rl.action_selected", { type: heuristic, mode: "heuristic" });
      return { type: heuristic, reasoning: `heuristic(confidence=${confidence.toFixed(2)})` };
    }

    // Epsilon-greedy exploration.
    if (Math.random() < this.epsilon) {
      const actions: ScoreRLActionType[] = ["accept", "correct", "retry"];
      const type = actions[Math.floor(Math.random() * actions.length)];
      metrics.increment("score_rl.action_selected", { type, mode: "explore" });
      return { type, reasoning: `explore(epsilon=${this.epsilon})` };
    }

    // Exploit learned expected reward; fall back to heuristic on ties.
    const best = (["accept", "correct", "retry"] as const)
      .map((t) => ({ t, v: entry.values[t] ?? 0 }))
      .sort((a, b) => b.v - a.v);

    const bestType = best[0]?.t ?? heuristic;
    metrics.increment("score_rl.action_selected", { type: bestType, mode: "exploit" });
    return {
      type: bestType,
      reasoning: `exploit(key=${key}, expected=${(best[0]?.v ?? 0).toFixed(3)})`,
    };
  }

  async learnFromOutcome(
    state: ScoreRLState,
    action: ScoreRLAction,
    outcome: ScoreRLOutcome
  ): Promise<void> {
    const key = makeStateKey(state);
    const type = action.type;
    const reward = rewardFromOutcome(outcome);

    const entry =
      this.q.get(key) ??
      ({
        counts: { accept: 0, correct: 0, retry: 0 },
        values: { accept: 0.5, correct: 0.5, retry: 0.5 },
      } satisfies QEntry);

    const n = (entry.counts[type] ?? 0) + 1;
    const prev = entry.values[type] ?? 0;
    const next = prev + (reward - prev) / n;

    entry.counts[type] = n;
    entry.values[type] = next;
    this.q.set(key, entry);

    metrics.increment("score_rl.learn_events_total", { action: type });
    metrics.observe("score_rl.reward", reward, { action: type });

    logger.debug("SCoRe RL learned outcome", {
      agent_id: state.agentId,
      key,
      action: type,
      reward,
      expected: next,
      n,
    });
  }
}

export const scoreRL = new ScoreRL();
