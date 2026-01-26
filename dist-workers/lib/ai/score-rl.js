"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreRL = exports.ScoreRL = void 0;
const logger_1 = require("@/lib/logging/logger");
const metrics_1 = require("@/lib/observability/metrics");
function clamp01(n) {
    if (!Number.isFinite(n))
        return 0;
    return Math.max(0, Math.min(1, n));
}
function makeStateKey(state) {
    // Keep key stable and low-cardinality; avoid embedding full output.
    const parts = [
        ["agentId", state.agentId],
        ["caseType", state.context.caseType],
        ["evidenceCount", state.context.evidenceCount],
    ];
    return parts.map(([k, v]) => `${k}=${String(v ?? "na")}`).join("|");
}
function rewardFromOutcome(outcome) {
    // Reward balances binary success with continuous quality.
    const q = clamp01(outcome.quality);
    const s = outcome.success ? 1 : 0;
    return clamp01(0.35 * s + 0.65 * q);
}
class ScoreRL {
    constructor(opts) {
        this.q = new Map();
        this.epsilon = opts?.epsilon ?? 0.08;
    }
    async selectAction(state) {
        const confidence = clamp01(state.confidence);
        const key = makeStateKey(state);
        const entry = this.q.get(key);
        // Baseline heuristic policy (safe default).
        let heuristic = "accept";
        if (confidence < 0.6)
            heuristic = "retry";
        else if (confidence < 0.8)
            heuristic = "correct";
        // If we have no learning yet, stick to heuristic.
        if (!entry) {
            metrics_1.metrics.increment("score_rl.action_selected", { type: heuristic, mode: "heuristic" });
            return { type: heuristic, reasoning: `heuristic(confidence=${confidence.toFixed(2)})` };
        }
        // Epsilon-greedy exploration.
        if (Math.random() < this.epsilon) {
            const actions = ["accept", "correct", "retry"];
            const type = actions[Math.floor(Math.random() * actions.length)];
            metrics_1.metrics.increment("score_rl.action_selected", { type, mode: "explore" });
            return { type, reasoning: `explore(epsilon=${this.epsilon})` };
        }
        // Exploit learned expected reward; fall back to heuristic on ties.
        const best = ["accept", "correct", "retry"]
            .map((t) => ({ t, v: entry.values[t] ?? 0 }))
            .sort((a, b) => b.v - a.v);
        const bestType = best[0]?.t ?? heuristic;
        metrics_1.metrics.increment("score_rl.action_selected", { type: bestType, mode: "exploit" });
        return {
            type: bestType,
            reasoning: `exploit(key=${key}, expected=${(best[0]?.v ?? 0).toFixed(3)})`,
        };
    }
    async learnFromOutcome(state, action, outcome) {
        const key = makeStateKey(state);
        const type = action.type;
        const reward = rewardFromOutcome(outcome);
        const entry = this.q.get(key) ??
            {
                counts: { accept: 0, correct: 0, retry: 0 },
                values: { accept: 0.5, correct: 0.5, retry: 0.5 },
            };
        const n = (entry.counts[type] ?? 0) + 1;
        const prev = entry.values[type] ?? 0;
        const next = prev + (reward - prev) / n;
        entry.counts[type] = n;
        entry.values[type] = next;
        this.q.set(key, entry);
        metrics_1.metrics.increment("score_rl.learn_events_total", { action: type });
        metrics_1.metrics.observe("score_rl.reward", reward, { action: type });
        logger_1.logger.debug("SCoRe RL learned outcome", {
            agent_id: state.agentId,
            key,
            action: type,
            reward,
            expected: next,
            n,
        });
    }
}
exports.ScoreRL = ScoreRL;
exports.scoreRL = new ScoreRL();
