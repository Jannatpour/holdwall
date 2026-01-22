/**
 * Task Context Management
 * 
 * Shared goals across agents for coordinated task execution.
 */

export interface TaskGoal {
  id: string;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  assignedAgents: string[];
  status: "pending" | "in_progress" | "completed" | "failed";
  dependencies: string[]; // Other goal IDs
}

export interface TaskContext {
  goals: Map<string, TaskGoal>;
  executionPlan: Array<{
    goalId: string;
    agentId: string;
    order: number;
  }>;
}

export class TaskContextManager {
  private taskContext: TaskContext = {
    goals: new Map(),
    executionPlan: [],
  };

  /**
   * Create task goal
   */
  createGoal(goal: Omit<TaskGoal, "id">): TaskGoal {
    const fullGoal: TaskGoal = {
      ...goal,
      id: crypto.randomUUID(),
    };

    this.taskContext.goals.set(fullGoal.id, fullGoal);
    return fullGoal;
  }

  /**
   * Get goal
   */
  getGoal(goalId: string): TaskGoal | null {
    return this.taskContext.goals.get(goalId) || null;
  }

  /**
   * Update goal status
   */
  updateGoalStatus(goalId: string, status: TaskGoal["status"]): void {
    const goal = this.taskContext.goals.get(goalId);
    if (goal) {
      goal.status = status;
    }
  }

  /**
   * Get ready goals (dependencies met)
   */
  getReadyGoals(): TaskGoal[] {
    return Array.from(this.taskContext.goals.values())
      .filter(goal => {
        if (goal.status !== "pending") {
          return false;
        }

        // Check dependencies
        for (const depId of goal.dependencies) {
          const dep = this.taskContext.goals.get(depId);
          if (!dep || dep.status !== "completed") {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  /**
   * Create execution plan
   */
  createExecutionPlan(): TaskContext["executionPlan"] {
    const plan: TaskContext["executionPlan"] = [];
    const goals = Array.from(this.taskContext.goals.values());

    // Topological sort based on dependencies
    const sorted = this.topologicalSort(goals);

    let order = 0;
    for (const goal of sorted) {
      for (const agentId of goal.assignedAgents) {
        plan.push({
          goalId: goal.id,
          agentId,
          order: order++,
        });
      }
    }

    this.taskContext.executionPlan = plan;
    return plan;
  }

  /**
   * Topological sort
   */
  private topologicalSort(goals: TaskGoal[]): TaskGoal[] {
    const sorted: TaskGoal[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (goal: TaskGoal) => {
      if (visiting.has(goal.id)) {
        return; // Cycle detected
      }

      if (visited.has(goal.id)) {
        return;
      }

      visiting.add(goal.id);

      // Visit dependencies first
      for (const depId of goal.dependencies) {
        const dep = goals.find(g => g.id === depId);
        if (dep) {
          visit(dep);
        }
      }

      visiting.delete(goal.id);
      visited.add(goal.id);
      sorted.push(goal);
    };

    for (const goal of goals) {
      if (!visited.has(goal.id)) {
        visit(goal);
      }
    }

    return sorted;
  }
}
