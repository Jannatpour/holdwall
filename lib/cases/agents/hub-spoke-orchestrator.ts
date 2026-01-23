/**
 * Hub-and-Spoke Orchestration Pattern
 * 
 * Central hub coordinates multiple specialized agents (spokes) for case resolution.
 * Provides centralized coordination, load balancing, and fault tolerance.
 * 
 * Latest January 2026 orchestration pattern for multi-agent systems.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import type { Case, CaseResolution } from "@prisma/client";

export interface HubSpokeAgent {
  id: string;
  name: string;
  capabilities: string[];
  status: "idle" | "busy" | "error";
  load: number; // 0.0-1.0
}

export interface HubSpokeTask {
  id: string;
  agentId: string;
  description: string;
  priority: number;
  status: "pending" | "assigned" | "in_progress" | "completed" | "failed";
  result?: unknown;
}

export interface HubSpokeOrchestration {
  hubId: string;
  tasks: HubSpokeTask[];
  agents: HubSpokeAgent[];
  status: "idle" | "active" | "completed" | "failed";
  metadata: {
    startTime: Date;
    endTime?: Date;
    latencyMs?: number;
  };
}

/**
 * Hub-and-Spoke Orchestrator
 * 
 * Central hub that coordinates multiple agent spokes
 */
export class HubSpokeOrchestrator {
  private agents: Map<string, HubSpokeAgent> = new Map();
  private tasks: Map<string, HubSpokeTask> = new Map();
  private orchestrations: Map<string, HubSpokeOrchestration> = new Map();

  /**
   * Register an agent (spoke)
   */
  registerAgent(agent: HubSpokeAgent): void {
    this.agents.set(agent.id, agent);
    logger.info("Agent registered", { agentId: agent.id, name: agent.name });
  }

  /**
   * Orchestrate case resolution using hub-and-spoke pattern
   */
  async orchestrate(
    case_: Case,
    resolution: CaseResolution | null,
    agentTasks: Array<{
      agentId: string;
      description: string;
      priority: number;
      execute: () => Promise<unknown>;
    }>
  ): Promise<HubSpokeOrchestration> {
    const orchestrationId = `orchestration-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const startTime = new Date();

    try {
      logger.info("Hub-and-spoke orchestration started", {
        orchestrationId,
        caseId: case_.id,
        taskCount: agentTasks.length,
      });

      // Step 1: Create tasks
      const tasks: HubSpokeTask[] = agentTasks.map((task) => ({
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        agentId: task.agentId,
        description: task.description,
        priority: task.priority,
        status: "pending",
      }));

      // Step 2: Assign tasks to agents (load balancing)
      const assignedTasks = await this.assignTasks(tasks);

      // Step 3: Execute tasks in priority order with concurrency control
      const results = await this.executeTasks(assignedTasks, agentTasks);

      // Step 4: Aggregate results
      const aggregated = await this.aggregateResults(results);

      const endTime = new Date();
      const latencyMs = endTime.getTime() - startTime.getTime();

      const orchestration: HubSpokeOrchestration = {
        hubId: orchestrationId,
        tasks: assignedTasks,
        agents: Array.from(this.agents.values()),
        status: "completed",
        metadata: {
          startTime,
          endTime,
          latencyMs,
        },
      };

      this.orchestrations.set(orchestrationId, orchestration);

      metrics.increment("hub_spoke.orchestrations");
      metrics.observe("hub_spoke.latency", latencyMs);

      logger.info("Hub-and-spoke orchestration completed", {
        orchestrationId,
        taskCount: assignedTasks.length,
        latencyMs,
      });

      return orchestration;
    } catch (error) {
      logger.error("Hub-and-spoke orchestration failed", {
        orchestrationId,
        error: error instanceof Error ? error.message : String(error),
      });

      const endTime = new Date();
      const orchestration: HubSpokeOrchestration = {
        hubId: orchestrationId,
        tasks: [],
        agents: Array.from(this.agents.values()),
        status: "failed",
        metadata: {
          startTime,
          endTime,
          latencyMs: endTime.getTime() - startTime.getTime(),
        },
      };

      this.orchestrations.set(orchestrationId, orchestration);
      return orchestration;
    }
  }

  /**
   * Assign tasks to agents with load balancing
   */
  private async assignTasks(tasks: HubSpokeTask[]): Promise<HubSpokeTask[]> {
    // Sort tasks by priority
    const sortedTasks = [...tasks].sort((a, b) => b.priority - a.priority);

    // Assign tasks to least-loaded agents
    for (const task of sortedTasks) {
      const agent = this.agents.get(task.agentId);
      if (!agent) {
        logger.warn("Agent not found", { agentId: task.agentId });
        task.status = "failed";
        continue;
      }

      // Check if agent is available
      if (agent.status === "error" || agent.load > 0.9) {
        // Find alternative agent with similar capabilities
        const alternative = this.findAlternativeAgent(agent.capabilities, task.agentId);
        if (alternative) {
          task.agentId = alternative.id;
          task.status = "assigned";
          alternative.load += 0.1;
        } else {
          task.status = "failed";
        }
      } else {
        task.status = "assigned";
        agent.status = "busy";
        agent.load += 0.1;
      }
    }

    return sortedTasks;
  }

  /**
   * Find alternative agent with similar capabilities
   */
  private findAlternativeAgent(
    requiredCapabilities: string[],
    excludeAgentId: string
  ): HubSpokeAgent | null {
    const candidates = Array.from(this.agents.values())
      .filter((a) => a.id !== excludeAgentId && a.status !== "error" && a.load < 0.9)
      .filter((a) => requiredCapabilities.some((cap) => a.capabilities.includes(cap)))
      .sort((a, b) => a.load - b.load);

    return candidates[0] || null;
  }

  /**
   * Execute tasks with concurrency control
   */
  private async executeTasks(
    tasks: HubSpokeTask[],
    agentTasks: Array<{ agentId: string; execute: () => Promise<unknown> }>
  ): Promise<Map<string, unknown>> {
    const results = new Map<string, unknown>();
    const maxConcurrency = 5; // Limit concurrent executions
    const executing: Promise<void>[] = [];

    for (const task of tasks) {
      if (task.status !== "assigned") continue;

      const agentTask = agentTasks.find((t) => t.agentId === task.agentId);
      if (!agentTask) {
        task.status = "failed";
        continue;
      }

      const executePromise = (async () => {
        try {
          task.status = "in_progress";
          const result = await agentTask.execute();
          task.status = "completed";
          task.result = result;
          results.set(task.id, result);

          // Update agent status
          const agent = this.agents.get(task.agentId);
          if (agent) {
            agent.load = Math.max(0, agent.load - 0.1);
            if (agent.load < 0.1) {
              agent.status = "idle";
            }
          }
        } catch (error) {
          task.status = "failed";
          logger.error("Task execution failed", {
            taskId: task.id,
            agentId: task.agentId,
            error: error instanceof Error ? error.message : String(error),
          });

          // Update agent status
          const agent = this.agents.get(task.agentId);
          if (agent) {
            agent.status = "error";
            agent.load = Math.max(0, agent.load - 0.1);
          }
        }
      })();

      executing.push(executePromise);

      // Limit concurrency
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
        executing.splice(
          executing.findIndex((p) => p === executePromise),
          1
        );
      }
    }

    // Wait for all remaining tasks
    await Promise.all(executing);

    return results;
  }

  /**
   * Aggregate results from all tasks
   */
  private async aggregateResults(results: Map<string, unknown>): Promise<unknown> {
    // Simplified aggregation - in production, use more sophisticated merging
    return {
      results: Array.from(results.entries()).map(([taskId, result]) => ({
        taskId,
        result,
      })),
      summary: `Aggregated ${results.size} task results`,
    };
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId: string): HubSpokeAgent | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all agents
   */
  getAllAgents(): HubSpokeAgent[] {
    return Array.from(this.agents.values());
  }
}

export const hubSpokeOrchestrator = new HubSpokeOrchestrator();
