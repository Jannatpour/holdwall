/**
 * Agent Reliability Tracking
 * 
 * Tracks Task Completion Rate, Tool Usage Accuracy, and
 * silent reasoning errors for agent performance monitoring.
 */

export interface AgentTask {
  id: string;
  agentId: string;
  taskType: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AgentReliability {
  agentId: string;
  taskCompletionRate: number; // 0-1
  toolUsageAccuracy: number; // 0-1
  errorRate: number; // 0-1
  averageLatency: number; // milliseconds
  reliabilityScore: number; // 0-1
}

export class ReliabilityTracker {
  private tasks: Map<string, AgentTask> = new Map();
  private toolUsage: Map<string, Array<{
    tool: string;
    success: boolean;
    timestamp: string;
  }>> = new Map(); // agentId -> tool usage

  /**
   * Record task
   */
  recordTask(task: Omit<AgentTask, "id" | "startedAt">): AgentTask {
    const fullTask: AgentTask = {
      ...task,
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };

    this.tasks.set(fullTask.id, fullTask);
    return fullTask;
  }

  /**
   * Update task status
   */
  updateTaskStatus(
    taskId: string,
    status: AgentTask["status"],
    error?: string
  ): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (status === "completed" || status === "failed") {
        task.completedAt = new Date().toISOString();
      }
      if (error) {
        task.error = error;
      }
    }
  }

  /**
   * Record tool usage
   */
  recordToolUsage(
    agentId: string,
    tool: string,
    success: boolean
  ): void {
    if (!this.toolUsage.has(agentId)) {
      this.toolUsage.set(agentId, []);
    }

    this.toolUsage.get(agentId)!.push({
      tool,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Calculate reliability for agent
   */
  calculateReliability(agentId: string): AgentReliability {
    // Task completion rate
    const agentTasks = Array.from(this.tasks.values())
      .filter(t => t.agentId === agentId);

    const completed = agentTasks.filter(t => t.status === "completed").length;
    const total = agentTasks.length;
    const taskCompletionRate = total > 0 ? completed / total : 0.5;

    // Tool usage accuracy
    const toolHistory = this.toolUsage.get(agentId) || [];
    const successfulTools = toolHistory.filter(t => t.success).length;
    const toolUsageAccuracy = toolHistory.length > 0
      ? successfulTools / toolHistory.length
      : 0.5;

    // Error rate
    const failed = agentTasks.filter(t => t.status === "failed").length;
    const errorRate = total > 0 ? failed / total : 0;

    // Average latency
    const completedTasks = agentTasks.filter(t => 
      t.status === "completed" && t.completedAt
    );
    const averageLatency = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => {
          const latency = new Date(t.completedAt!).getTime() - 
                         new Date(t.startedAt).getTime();
          return sum + latency;
        }, 0) / completedTasks.length
      : 0;

    // Reliability score (weighted)
    const reliabilityScore = 
      taskCompletionRate * 0.4 +
      toolUsageAccuracy * 0.3 +
      (1 - errorRate) * 0.3;

    return {
      agentId,
      taskCompletionRate,
      toolUsageAccuracy,
      errorRate,
      averageLatency,
      reliabilityScore,
    };
  }

  /**
   * Get agent tasks
   */
  getAgentTasks(agentId: string): AgentTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.agentId === agentId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
}
