/**
 * Stateless Executor
 * 
 * Stateless servers for resiliency and horizontal scaling.
 * All state is passed in requests.
 */

import type { MCPToolCall, MCPToolResult } from "./types";
import { InMemoryMCPToolRegistry } from "./registry";

export interface StatelessRequest {
  toolCall: MCPToolCall;
  context?: {
    sessionId?: string;
    userId?: string;
    tenantId?: string;
    previousResults?: Array<{ tool: string; result: unknown }>;
  };
}

export interface StatelessResponse {
  result: MCPToolResult;
  context?: {
    sessionId?: string;
    nextActions?: string[];
  };
}

export class StatelessExecutor {
  private toolRegistry: InMemoryMCPToolRegistry;

  constructor() {
    this.toolRegistry = new InMemoryMCPToolRegistry();
  }

  /**
   * Execute tool call statelessly
   */
  async execute(request: StatelessRequest): Promise<StatelessResponse> {
    const { toolCall, context } = request;

    // Execute tool via registry (stateless - all state in context)
    let result: MCPToolResult;
    try {
      const registryResult = await this.toolRegistry.call(toolCall);
      result = registryResult;
    } catch (error) {
      result = {
        call_id: toolCall.call_id,
        success: false,
        error: {
          code: "EXECUTION_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }

    // Return context for next request
    return {
      result,
      context: {
        sessionId: context?.sessionId,
        nextActions: this.suggestNextActions(toolCall, result),
      },
    };
  }

  /**
   * Execute tool (stateless)
   * All state comes from context parameter - no internal state maintained
   */
  private async executeTool(
    toolCall: MCPToolCall,
    context?: StatelessRequest["context"]
  ): Promise<unknown> {
    // Execute via registry (which is stateless)
    const result = await this.toolRegistry.call(toolCall);
    
    if (!result.success) {
      throw new Error(result.error?.message || "Tool execution failed");
    }

    // Include context in result for chaining
    return {
      tool: toolCall.tool_name,
      parameters: toolCall.parameters,
      result: result.result,
      context: context?.previousResults || [],
    };
  }

  /**
   * Suggest next actions
   */
  private suggestNextActions(
    toolCall: MCPToolCall,
    result: MCPToolResult
  ): string[] {
    // Suggest follow-up actions based on result
    const actions: string[] = [];

    if (result.success) {
      actions.push("Continue with next step");
      actions.push("Verify result");
    } else {
      actions.push("Retry with different parameters");
      actions.push("Escalate to human");
    }

    return actions;
  }
}
