/**
 * Agent Orchestrator
 * Coordinates multiple AI agents with ACP/MCP
 */

import { ACPClientImpl } from "@/lib/acp/client";
import { HTTPACPTransport } from "@/lib/acp/client";
import { ProductionMCPOrchestrator } from "@/lib/mcp/orchestrator";
import { InMemoryMCPToolRegistry } from "@/lib/mcp/registry";
import type { ACPMessageEnvelope } from "@/lib/acp/types";

export interface AgentTask {
  task_id: string;
  task_type: string;
  parameters: Record<string, unknown>;
  priority: number;
  deadline?: string;
}

export class AgentOrchestrator {
  private acpClient: ACPClientImpl;
  private mcpOrchestrator: ProductionMCPOrchestrator;

  constructor() {
    const transport = new HTTPACPTransport(
      process.env.ACP_SERVER_URL || "http://localhost:3001"
    );
    this.acpClient = new ACPClientImpl(transport);

    const toolRegistry = new InMemoryMCPToolRegistry();
    this.mcpOrchestrator = new ProductionMCPOrchestrator(toolRegistry);
  }

  /**
   * Execute agent task
   */
  async executeTask(task: AgentTask): Promise<{
    task_id: string;
    status: "completed" | "failed";
    result?: unknown;
    error?: string;
  }> {
    // Send task request via ACP
    const messageId = await this.acpClient.send("task.request", {
      task_id: task.task_id,
      task_type: task.task_type,
      parameters: task.parameters,
      priority: task.priority,
      deadline: task.deadline,
    });

      // Listen for task updates
      return new Promise((resolve) => {
        this.acpClient.on("task.result", async (envelope: ACPMessageEnvelope) => {
          const payload = envelope.payload as any;
          if (payload.task_id === task.task_id) {
            resolve({
              task_id: task.task_id,
              status: payload.status,
              result: payload.result,
              error: payload.error?.message,
            });
          }
        });
      });
  }

  /**
   * Execute tool via MCP
   */
  async executeTool(
    tool_name: string,
    parameters: Record<string, unknown>
  ): Promise<unknown> {
    const tool_call = {
      call_id: crypto.randomUUID(),
      tool_name,
      parameters,
    };

    const result = await this.mcpOrchestrator.execute(tool_call, {
      require_approval: true,
      track_cost: true,
    });

    if (!result.success) {
      throw new Error(result.error?.message || "Tool execution failed");
    }

    return result.result;
  }
}
