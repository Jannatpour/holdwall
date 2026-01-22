/**
 * MCP Orchestrator Implementation
 * Production orchestrator with policy, cost, and evaluation-based tool selection
 */

import type {
  MCPOrchestrator,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
} from "./types";
import { InMemoryMCPToolRegistry } from "./registry";
import { getCache, setCache } from "@/lib/cache/redis";

export class ProductionMCPOrchestrator implements MCPOrchestrator {
  constructor(private toolRegistry: InMemoryMCPToolRegistry) {}

  async selectTool(task: {
    type: string;
    requirements?: {
      cost_limit?: number;
      approval_required?: boolean;
      evidence_required?: boolean;
    };
  }): Promise<MCPTool | null> {
    const availableTools = this.toolRegistry.list();

    // Filter by requirements
    let candidates = availableTools;

    if (task.requirements?.approval_required === false) {
      candidates = candidates.filter((t) => !t.requires_approval);
    }

    if (task.requirements?.evidence_required === false) {
      candidates = candidates.filter((t) => !t.requires_evidence);
    }

    if (task.requirements?.cost_limit) {
      candidates = candidates.filter((t) => {
        const estimatedCost = t.cost?.credits || t.cost?.tokens || 0;
        return estimatedCost <= task.requirements!.cost_limit!;
      });
    }

    // Select best tool (in production, use ML-based selection)
    // For MVP, return first candidate
    return candidates[0] || null;
  }

  async execute(
    tool_call: MCPToolCall,
    options?: {
      require_approval?: boolean;
      track_cost?: boolean;
    }
  ): Promise<MCPToolResult> {
    // Check cache first
    const cacheKey = `mcp:tool:${tool_call.tool_name}:${JSON.stringify(tool_call.parameters)}`;
    const cached = await getCache<MCPToolResult>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if approval required
    const tool = this.toolRegistry.get(tool_call.tool_name, tool_call.tool_version);
    if (tool?.requires_approval && options?.require_approval !== false) {
      return {
        call_id: tool_call.call_id,
        success: false,
        error: {
          code: "APPROVAL_REQUIRED",
          message: "Tool requires approval before execution",
        },
      };
    }

    // Execute tool
    const result = await this.toolRegistry.call(tool_call);

    // Cache result if successful
    if (result.success && options?.track_cost !== false) {
      await setCache(cacheKey, result, { ttl: 3600 }); // Cache for 1 hour
    }

    return result;
  }
}
